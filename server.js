// init project
const express = require('express');
const CookieParser = require('cookie-parser')
const ScheduleGenerator = require('./lib/run')
const request = require('request')
const _ = require('lodash')

var app = express();
app.use(CookieParser());
app.use(express.static('public'));

const ALLOWED_SCHOOLS = ['uottawa'];


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
  
  if (!code || code === 'access_denied' || !school || ALLOWED_SCHOOLS.indexOf(school) === -1)
    res.redirect('/');
  else
    res.sendFile(`${__dirname}/views/${school}.html`);
})



// listen for requests
var listener = app.listen(process.env.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});

/* Websockets handling */
var io = require('socket.io')(listener);

io.on('connection', (socket) => {
  console.log('a user connected');
  var jar, chosenSemesters, courses = {}, chosenColours;
  
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
    var ok =  _.isArray(data) ? true : false;

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
