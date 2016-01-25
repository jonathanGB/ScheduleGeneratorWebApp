// TODO: implement findCourses() and change insertIntoCalendar options with the course properties

var cronofy = require('cronofy');
var fs = require('fs');
var cheerio = require('cheerio');

const CRONOFY_TOKEN = "cronofy_token"; // if you set a different environment variable name, change it here
var currEventId;
var calendarId;

// get event_id, which is needed to add events to cronofy
function getCurrEventId() {
	try {
		currEventId = fs.readFileSync('currEventId')
	} catch (e) {
		currEventId = 0;
		fs.writeFile('currEventId.txt', '0');
	}
}

// set event_id at the end, so future calls will start with the right Id (and not overwrite previous events)
function setCurrEventId() {
	fs.writeFile('currEventId.txt', currEventId);
}

// get the calendar_id, which is needed by cronofy
function getCalendarId(callback) {
	cronofy.listCalendars({access_token: process.env[CRONOFY_TOKEN]}, function (err, response) {
		if (err)
			console.log("== PROBLEM READING CRONOFY ACCOUNT. IS THE ENVIRONMENT VARIABLE SET PROPERLY?");
		else {
			calendarId = response.calendars[0].calendar_id;

			if (callback && typeof callback === 'function')
				callback();
		}
	});
}

// schedule parser
function findCourses() {
 // to implement
 // for every new time slot, call insertIntoCalendar() with a litteral object containing information about the course
 // if last iteration, add setCurrEventId() as a callback to insertIntoCalendar()
}

// generate calendar events
function insertIntoCalendar(course, callback) {
	var options = {
		calendar_id: calendarId,
	    access_token: process.env[CRONOFY_TOKEN],
	    event_id: "cronofy-school" + currEventId++,
	    summary: "Board meeting",
	    description: "Discuss plans for the next quarter.",
	    start: "2016-01-26T15:30:00Z",
	    end: "2016-01-26T17:00:00Z",
	    location: {
	        description: "Board room"
	    }
	};

	cronofy.createEvent(options, function (err, response) {
		if (err) {
			console.log("== PROBLEM CREATING EVENT IN CALENDAR"); // add more information in error message
		} else {
			console.log("Event created!"); // add which event was created (console.log)
		}

		if (callback && typeof callback === 'function')
			callback();
	});
}



function main() {
	getCurrEventId();
	getCalendarId(findCourses);
}

// run parser and generator
main();