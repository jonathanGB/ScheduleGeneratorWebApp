// init project
const express = require('express');
const ScheduleGenerator = require('./lib/run')
const request = require('request')
const url = require('url')
const _ = require('lodash')
const sslRedirect = require('heroku-ssl-redirect')

var app = express();
app.use(sslRedirect());
app.use(express.static('public'));

const ALLOWED_SCHOOLS = ['uottawa'];
let gAuths = {} // store auth tokens for access in router and in websocket handler


// routes
app.get("/", function (req, res) {
	res.sendFile(__dirname + '/views/index.html');
});


app.get("/getToken/:school", (req, res) => {
	var authURL = `${ScheduleGenerator.getAuthURL()}&state=${req.params.school}`;

	res.redirect(authURL);
});

app.get("/run", (req, res) => {
	var code = req.query.code;
	var school = req.query.state;

	if (!code || code === 'access_denied' || !school || !ALLOWED_SCHOOLS.includes(school))
		res.redirect('/');
	else {
		// validate code
		ScheduleGenerator.verifyAuth(code, (gAuth) => {
			if (gAuth) {
				gAuths[code] = gAuth
				res.sendFile(`${__dirname}/views/${school}.html`);
			} else {
				res.redirect('/');
			}
		})
	}
})



// listen for requests
var listener = app.listen(process.env.PORT, () => {
	console.log('Your app is listening on port ' + listener.address().port);
});
listener.timeout = 300000; // timeout of 5mins

/* Websockets handling */
var io = require('socket.io')(listener);

io.on('connection', (socket) => {
	console.log('a user connected')
	var jar, chosenSemesters, courses = {}, insertedEventIds = [],
		chosenColours, code = url.parse(socket.request.headers.referer, true).query.code;

	// clean closure memory
	socket.on('disconnect', () => {
		console.log('a user disconnected');
		delete gAuths[code];

		ScheduleGenerator.logoutUser(jar, () => {
			jar = null, chosenSemesters = null, courses = null, chosenColours = null, code = null, insertedEventIds = null;
		});
	})

	socket.on('verify credentials', (data, clientCallback) => {
		jar = request.jar();

		ScheduleGenerator.verifyCredentials(data, jar, clientCallback, () => {
			// this callback will only be called if credentials are valid
			// this fetches the semesters to choose from
			ScheduleGenerator.grabSemesters(jar, (semesters) => {
				socket.emit('grab semesters', semesters);
			})
		})
	});

	socket.on('choose semesters', (data, clientCallback) => {
		var ok = _.isArray(data) ? true : false;

		if (ok)
			chosenSemesters = data;

		clientCallback(ok);

		// TODO: grab schedules & parse
		// @param courses is modified directly by `grabSchedules`
		ScheduleGenerator.grabSchedules(jar, courses, chosenSemesters, (err) => {
			var coursesInfo = getCoursesInfo(courses);

			socket.emit('grab schedules', {
				err,
				coursesInfo
			});
		});
	});

	socket.on('choose colours', (data, clientCallback) => {
		var ok = _.isPlainObject(data) ? true : false;

		if (ok)
			chosenColours = data;

		clientCallback(ok);
	});

	socket.on('generate schedule', () => {
		const gAuth = gAuths[code]
		if (gAuth) {
			ScheduleGenerator.insertCourses(gAuth, courses, chosenColours, (ok, course, insertedEventId) => {
				socket.emit('inserted course', {
					ok,
					course
				});

				if (insertedEventId) {
					insertedEventIds.push(insertedEventId);
				}
			}, (ok) => { // this callback is called when all courses are inserted (or there was an error)
				var status = ok === null ? true : false;

				socket.emit('inserted all courses', status);
				console.log(insertedEventIds)
			})
		} else {
			socket.emit('inserted all courses', false)
		}
	});

	socket.on('delete schedule', (_, clientCallback) => {
		const gAuth = gAuths[code];
		if (!gAuth) {
			return clientCallback(new Error('Invalid gAuth'));
		}

		ScheduleGenerator.deleteCourses(gAuth, insertedEventIds, clientCallback);
	});
});

function getCoursesInfo(semesters) {
	var coursesInfo = {};

	_.forEach(semesters, (courses, semester) => {
		coursesInfo[semester] = {};

		_.forEach(courses, (data, course) => {
			coursesInfo[semester][course] = data.info;
		})
	})

	return coursesInfo;
}

setInterval(() => { // clean gAuths every hour
	let now = Date.now()

	Object.keys(gAuths).forEach(key => {
		if (gAuths[key].credentials.expiry_date <= now) {
			delete gAuths[key]
		}
	})
}, 1000 * 3600)
