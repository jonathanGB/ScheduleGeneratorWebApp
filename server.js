// init project
const express = require('express');
const CookieParser = require('cookie-parser')
const ScheduleGenerator = require('./lib/run')
const request = require('request')

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
  var jar;
  
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
  
  
});
