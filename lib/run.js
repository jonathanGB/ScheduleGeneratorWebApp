const cheerio = require('cheerio');
const request = require('request');
const chalk = require('chalk');
//request.debug = true;
const _ = require('lodash');
const async = require('async');
const _gCalendar = require('./eventsToGCalendar');

// public methods
exports.getAuthURL = _gCalendar.getAuthURL;
exports.verifyAuth = _gCalendar.getAuth;
exports.verifyCredentials = verifyCredentials;
exports.grabSemesters = grabSemesters;
exports.grabSchedules = grabSchedules;
exports.insertCourses = insertCourses;

function verifyCredentials(creds, jar, clientCallback, successCallback) {
	request({
		method: 'post',
		url: 'https://uozone2.uottawa.ca/pkmslogin.form?token=Unknown',
		qs: {
			language: 'en'
		},
		jar,
		form: {
			username: creds.username,
			password: creds.password,
			"login-form-type": 'pwd'
		}
	}, (err, res) => {
		if (err)
			return clientCallback(false);

		request({
			url: 'https://uozone2.uottawa.ca/',
			jar
		}, (err, res, body) => {
			if (err)
				return clientCallback(false);

			var $ = cheerio.load(body);

			if ($('body').hasClass('logged-in')) {
				clientCallback(true);
				successCallback();
			} else {
				clientCallback(false);
			}
		})
	})
}

function grabSemesters(jar, emitCallback) {
	request({
		url: 'https://uozone2.uottawa.ca/apps/course_schedule',
		jar
	}, (err, res, body) => {
		if (err)
			return callback(null);

		var $ = cheerio.load(body);
		emitCallback(getSemesters($));
	})
}

function getSemesters($) {
	var semesters = {};

	$('#edit-term-select option').each(function () {
		semesters[$(this).text().trim()] = $(this).val();
	});

	return semesters;
}

function grabSchedules(jar, courses, chosenSemesters, successCallback) {
	async.each(chosenSemesters, (semester, callback) => {
		var semesterTitle = semester[0], semesterCode = semester[1];
		courses[semesterTitle] = {};

		request({
			url: 'https://uozone2.uottawa.ca/apps/course_schedule',
			qs: {
				strm: semesterCode
			},
			jar
		}, (err, response, body) => {
			if (err) {
				callback(err)
			} else {
				var $ = cheerio.load(body);

				parseSemesterSchedule($, courses[semesterTitle]);
				callback();
			}
		});
	}, successCallback)
}

function parseSemesterSchedule($, courses) {
	const dayValue = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // diff from start

	var $form = $('.tabgroup-1 form').eq(0);
	var $tables = $form.find('#uo_schedule_course_table');

	$tables.each(function (i) {
		var caption = $(this).children('caption').text().trim();
		var courseSymbol = caption.substr(0, 7);
		var courseTitle = caption.slice(8).trim();

		var courseKey = `${courseSymbol}: ${courseTitle}`;
		courses[courseKey] = {
			info: [],
			data: []
		};

		$(this).find('tbody tr').each(function (j) {
			var $row = $(this);

			if ($row.children('td').eq(2).text().trim() == "") {
				return true; // next iteration
			}

			var semesterTime = $row.children('td').eq(1).text().trim().split(' to ');
			var semesterStart = new Date(semesterTime[0]);
			var semesterEnd = new Date(semesterTime[1]);
			semesterEnd.setDate(semesterEnd.getDate() + 1); // so UNTIL clause works for the last day of semester
			var periodDay = $row.children('td').eq(0).text().trim().toLowerCase();
			var periodTime = $row.children('td').eq(2).text().trim().split(' to ');
			var diffFromStart = (dayValue.indexOf(periodDay) - semesterStart.getUTCDay()).mod(7); // difference from semesterStart date object, with modulo of 7 to wrap around the week
			var periodStart = periodTime[0];
			var periodEnd = periodTime[1];
			var periodStartDateObj = new Date(`${semesterTime[0]} ${periodStart}`);
			periodStartDateObj.setDate(periodStartDateObj.getDate() + diffFromStart);
			var periodEndDateObj = new Date(`${semesterTime[0]} ${periodEnd}`);
			periodEndDateObj.setDate(periodEndDateObj.getDate() + diffFromStart);
			var periodType = $row.children('td').eq(3).text().trim().toLowerCase();
			var periodLocation = $row.children('td').eq(6).text().trim();

			courses[courseKey].info.push(`${periodDay} ${periodTime.join('-')} ${periodType} ${periodLocation}`);
			courses[courseKey].data.push({
				courseTitle,
				periodLocation,
				periodType,
				summary: `${courseSymbol} - ${periodType}`,
				periodStartDateObj,
				periodEndDateObj,
				semesterEnd: `${semesterEnd.toISOString().slice(0, 10).replace(/-/g, '')}` // format is YYYYMMDD
			});
		});

		if (courses[courseKey].info.length === 0)
			delete courses[courseKey]; // course object happens to have no valid period
	});
}

function insertCourses(code, coursesObj, chosenColours, insertCallback, finalCallback) {
	_gCalendar.getAuth(code, (gAuth) => {
		if (!gAuth) {
			console.error('Error authenticating')
			return finalCallback(false)
		}

		async.eachOfSeries(coursesObj, (courses, semester, outerCallback) => { // series-loop of semesters
			async.eachOf(courses, (periods, course, innerCallback) => { // loop of courses
				async.eachOf(periods.data, (period, index, periodCallback) => { // loop of periods
					var periodObj = getPeriodObj(period, getColorId(period.periodType, chosenColours));
					var id = [semester, course, index];

					_gCalendar.insertEvent(gAuth, periodObj, id, (ok) => {
						insertCallback(ok, id) // emit websockets "insert" event back to client

						ok ?
							periodCallback() :
							periodCallback(new Error('error inserting'));
					});
				}, innerCallback)
			}, outerCallback)
		}, finalCallback)
	});
}

function getPeriodObj(period, colorId) {
	return {
		description: period.courseTitle,
		location: period.periodLocation,
		summary: period.summary,
		start: {
			dateTime: period.periodStartDateObj.toISOString(),
			timeZone: 'America/Montreal'
		},
		end: {
			dateTime: period.periodEndDateObj.toISOString(),
			timeZone: 'America/Montreal'
		},
		recurrence: [
			`RRULE:FREQ=WEEKLY;UNTIL=${period.semesterEnd}`
		],
		reminders: {
			useDefault: false,
			overrides: []
		},
		colorId
	}
}

function getColorId(type, chosenColours) {
	if (type.includes('lecture'))
		return chosenColours.lecture;

	if (type.includes('lab'))
		return chosenColours.lab;

	return chosenColours.dgd;
}


// modify prototype with correct mathemtical modulo
Number.prototype.mod = function (n) {
	return ((this % n) + n) % n;
};
