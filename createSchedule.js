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
	console.log('== API CALLS FINISHED. CALENDAR FULLY GENERATED');
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
// for every new time slot, call insertIntoCalendar() with a litteral object containing information about the course
// if last iteration, add setCurrEventId() as a callback to insertIntoCalendar()
function findCourses() {
 var dayValue = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
 var schedule = fs.readFileSync('schedule.html', 'utf8');

 var $ = cheerio.load(schedule);

 // iterate 1 course at the time
 for (var i = 0, n = $('div.view-content table').length; i < n; i++) {
 	var $table = $('div.view-content table').eq(i);
 	var caption = $table.children('caption').text();
 	var courseSymbol = caption.substr(0, 7);
 	var courseTitle = caption.slice(8, caption.lastIndexOf('(')).trim();
 	var semesterTime = caption.slice(caption.lastIndexOf('(') + 1, caption.lastIndexOf(')')).split(' ');
 	var semesterStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0]);
 	var semesterEnd = new Date(semesterTime[5] + ' ' +  semesterTime[4] + ' ' + semesterTime[3] + ' 23:59');

 	// iterate through the different periods of a course
 	for (var j = 0, p = $('tr', $table.children('tbody')).length; j < p; j++) {
 		var $row = $('tr', $table.children('tbody')).eq(j);
 		var periodDay = $row.children('td').eq(1).text().trim();
 		var diffFromStart = dayValue.indexOf(periodDay) - semesterStart.getDay(); // difference from semesterStart date object
 		var periodTime = $row.children('td').eq(2).text().trim().split(' ');
 		var periodStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[0]);
 		periodStart.setDate(periodStart.getDate() + diffFromStart);
 		var periodEnd = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[2]);
 		periodEnd.setDate(periodEnd.getDate() + diffFromStart);
 		var periodType = $row.children('td').eq(3).text().trim();
 		var periodLocation = $row.children('td').eq(4).text().trim();


	 	// loop through recurring slots of the event
		do {
		 	var courseObj = {
		 		title: courseTitle, // done
		 		symbol: courseSymbol, // done
		 		type: periodType, // done
		 		start: periodStart, // done
		 		end: periodEnd, // done
		 		location: periodLocation
		 	};

		 	// API call here
		 	if (i == n - 1 && j == p - 1) { // condition is to limit copy-construction of temporary date objects
		 		var tmpDate = new Date(periodEnd);
		 		tmpDate.setDate(tmpDate.getDate() + 7);

		 		tmpDate < semesterEnd ?
		 			insertIntoCalendar(courseObj) :
		 			insertIntoCalendar(courseObj, setCurrEventId); // very last call to the API, save the eventId
		 	} else {
		 		insertIntoCalendar(courseObj);
		 	}

		 	// increment date by a week (7 days)
		 	periodStart.setDate(periodStart.getDate() + 7);
		 	periodEnd.setDate(periodEnd.getDate() + 7);
		} while (periodEnd < semesterEnd);
	}
 }
}

// generate calendar events
function insertIntoCalendar(course, callback) {
	var options = {
		calendar_id: calendarId,
	    access_token: process.env[CRONOFY_TOKEN],
	    event_id: "cronofy-school" + currEventId++,
	    summary: course.title,
	    description: course.type + '-' + course.symbol,
	    tzid: 'America/Montreal',
	    start: course.start,
	    end: course.end,
	    location: {
	        description: course.location
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