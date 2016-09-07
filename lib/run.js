const cheerio = require('cheerio');
const request = require('request');
const chalk = require('chalk');
//request.debug = true;
const _ = require('lodash');
const async = require('async');
const _gCalendar = require('./eventsToGCalendar');

// public methods
exports.getAuthURL = _gCalendar.getAuthURL;
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
		url: 'https://uozone2.uottawa.ca/academic?language=en',
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

	$('#edit-session option').each(function () {
		semesters[$(this).text().trim()] = $(this).val();
	});

	return semesters;
}

function grabSchedules(jar, courses, chosenSemesters, successCallback) {
	async.each(chosenSemesters, (semester, callback) => {
		var semesterTitle = semester[0], semesterCode = semester[1];
		courses[semesterTitle] = {};

		request({
			url: 'https://uozone2.uottawa.ca/academic',
			qs: {
				language: 'en',
				session: semesterCode
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

	$('.panel-col-main div.view-content table').each(function (i) {
		var caption = $(this).children('caption').text().trim();
		var courseSymbol = caption.substr(0, 7);
		var courseTitle = caption.slice(8, caption.lastIndexOf('(')).trim();
		var semesterTime = caption.slice(caption.lastIndexOf('(') + 1, caption.lastIndexOf(')')).split(' ');
		var semesterStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0]);
		var semesterEnd = new Date(semesterTime[5] + ' ' + semesterTime[4] + ' ' + semesterTime[3]);
		semesterEnd.setDate(semesterEnd.getDate() + 1); // so UNTIL clause works for the last day of semester

		var courseKey = `${courseSymbol}: ${courseTitle}`;
		courses[courseKey] = {
			info: [],
			data: [],
			semesterStart,
			semesterEnd
		};

		$(this).find('tbody tr').each(function (j) {
			var $row = $(this);
			var periodDay = $row.children('td').eq(1).text().trim().toLowerCase();
			var periodTime = $row.children('td').eq(2).text().trim().split(' ');

			// edge case for courses which don't have specific periods
			if (!periodDay || periodTime.length < 3)
				return 'continue'; // returning a truthy value is equivalent to a "continue" statement

			var diffFromStart = (dayValue.indexOf(periodDay) - semesterStart.getDay()).mod(7); // difference from semesterStart date object, with modulo of 7 to wrap around the week
			var periodStart = periodTime[0];
			var periodEnd = periodTime[2];
			var periodStartDateObj = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[0]);
			periodStartDateObj.setDate(periodStartDateObj.getDate() + diffFromStart);
			var periodEndDateObj = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[2]);
			periodEndDateObj.setDate(periodEndDateObj.getDate() + diffFromStart);
			var periodType = $row.children('td').eq(3).text().trim().toLowerCase();
			var periodLocation = $row.children('td').eq(4).text().trim();

			courses[courseKey].info.push(`${periodDay} ${periodTime.join(' ')} ${periodType} ${periodLocation}`);
			courses[courseKey].data.push({
				courseTitle,
				periodLocation,
				periodType,
				summary: `${courseSymbol} - ${periodType}`,
				periodStartDateObj,
				periodEndDateObj
			});
		});

		if (courses[courseKey].info.length === 0)
			delete courses[courseKey]; // course object happens to have no valid period
	});
}

function insertCourses(code, coursesObj, chosenColours, insertCallback, finalCallback) {
	_gCalendar.getAuth(code, (gAuth) => {
		if (!gAuth)
			return finalCallback(false)

		async.eachOfSeries(coursesObj, (courses, semester, outerCallback) => {
			async.eachOf(courses, (periods, course, innerCallback) => {
				async.eachOf(periods.data, (period, index, periodCallback) => {
					var periodObj = getPeriodObj(period, periods, getColorId(period.periodType, chosenColours));
					var id = [semester, course, index];

					_gCalendar.insertEvent(gAuth, periodObj, id, (ok) => {
						insertCallback(ok, id);

						ok ?
							periodCallback() :
							periodCallback(new Error('error inserting'));
					});
				}, innerCallback)
			}, outerCallback)
		}, finalCallback)
	});
}

function getPeriodObj(period, periods, colorId) {
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
			`RRULE:FREQ=WEEKLY;UNTIL=${periods.semesterEnd.toISOString().slice(0, periods.semesterEnd.toISOString().indexOf('T')).replace(/-/g, '')}` // format is YYYYMMDD
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
