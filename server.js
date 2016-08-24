// init project
const express = require('express');
const CookieParser = require('cookie-parser')
const ScheduleGenerator = require('./lib/run')

var app = express();
app.use(CookieParser());
app.use(express.static('public'));


// routes
app.get("/", function (req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

app.get("/oauth", function (req, res) {
  res.send('topkek');
});


app.get("/uottawa", (req, res) => {
  res.send('uottawa')
});



// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});