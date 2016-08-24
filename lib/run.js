const cheerio = require('cheerio');
const request = require('request');
const chalk = require('chalk');
//request.debug = true;
const _ = require('lodash');
const _gCalendar = require('./eventsToGCalendar');

exports.getAuthURL = _gCalendar.getAuthURL;
exports.run = uOttawaScheduleCrawler;


function uOttawaScheduleCrawler(gAuth) {
	askUozoneCredentials((creds) => {
		console.log(chalk.blue('\nGenerating a login token!\n'));

		request({
			method: 'post',
			url: 'https://uozone2.uottawa.ca/pkmslogin.form?token=Unknown',
			qs: {
				language: 'en'
			},
			jar: true,
			form: {
				username: creds.username,
				password: creds.password,
				"login-form-type": 'pwd'
			}
		}, (err, res, body) => {
			if (err) throw new Error(err);

			console.log(chalk.blue('Token generated... testing if it is valid'));

			request({
				url: 'https://uozone2.uottawa.ca/',
				jar: true
			}, (err, res, body) => {
				if (err) throw new Error(err);

		 		verifyUozoneLogin(body, () => {
		 			request({
		 				url: 'https://uozone2.uottawa.ca/academic?language=en',
		 				jar: true
		 			}, (err ,res, body) => {
		 				if (err) throw new Error(err);

						var $ = cheerio.load(body);
						var semesters = getSemesters($);
						var colours = defineEventColours();

						inquirer.prompt([
							{
								type: 'checkbox',
								name: 'semesters',
								message: 'Select semesters to generate schedule',
								choices: function() {
									return Object.keys(semesters);
								},
								filter: function(answer) {
									var filteredAnswers = {};

									answer.forEach(function(semester) {
										filteredAnswers[semester] = semesters[semester];
									});

									return filteredAnswers;
								},
								validate: function(answer) { // for you Ryan...
									return _.isEmpty(answer) ?
											"You must choose at least one semester!":
											true;
								}
							},
							{
								type: 'list',
								name: 'lecColour',
								message: 'Specific colour for Lectures:',
								choices: function() {
									return Object.keys(colours);
								},
								filter: function(val) {
									return colours[val];
								}
							},
							{
								type: 'list',
								name: 'dgdTutColour',
								message: 'Specific colour for DGDs/Tutorials:',
								choices: function() {
									return Object.keys(colours);
								},
								filter: function(val) {
									return colours[val];
								}
							},
							{
								type: 'list',
								name: 'labColour',
								message: 'Specific colour for Labs:',
								choices: function() {
									return Object.keys(colours);
								},
								filter: function(val) {
									return colours[val];
								}
							}
						]).then(grabSchedules);
		 			});
		 		});
		 	});
		});
	});


	function askUozoneCredentials(callback) {
		inquirer.prompt([
			{
				type: 'input',
				name: 'username',
				message: 'uOzone username (left part of your uottawa email address):'
			},
			{
				type: 'password',
				name: 'password',
				message: 'uOzone password:'
			}
		]).then(callback);
	}

	function verifyUozoneLogin(body, callback) {
		var $ = cheerio.load(body);

		if ($('body').hasClass('logged-in')) {
			console.log(chalk.green('\nGood credentials\n'));
			callback();
		}
		else
			console.log(chalk.red('Bad uoZone credentials'));
	}

	function getSemesters($) {
		var semesters = {};

		$('#edit-session option').each(function() {
			semesters[$(this).text().trim()] = $(this).val();
		});

		return semesters;
	}

	function grabSchedules(chosenSemesters) {
		if (_.isEmpty(chosenSemesters.semesters))
			return;
		//console.log(chosenSemesters)
		var curKey = Object.keys(chosenSemesters.semesters)[0];
		var curId = chosenSemesters.semesters[curKey];
		delete chosenSemesters.semesters[curKey];

		console.log('\n\nGrabbing schedule of', chalk.magenta(curKey));

		request({
			url: 'https://uozone2.uottawa.ca/academic',
			qs: {
				language: 'en',
				session: curId
			},
			jar: true,
		}, function(err, response, body) {
			if (err) throw new Error(err);

			var $ = cheerio.load(body);

			parseSemesterSchedule($, chosenSemesters);

			setTimeout(() => {
				grabSchedules(chosenSemesters);
			}, 1000);
		});
	}

	function parseSemesterSchedule($, chosenSemesters) {
		var dayValue = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // diff from start

		$('.panel-col-main div.view-content table').each(function(i) {
	  	var caption = $(this).children('caption').text().trim();
	  	var courseSymbol = caption.substr(0, 7);
	  	var courseTitle = caption.slice(8, caption.lastIndexOf('(')).trim();
	  	var semesterTime = caption.slice(caption.lastIndexOf('(') + 1, caption.lastIndexOf(')')).split(' ');
			var semesterStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0]);
		 	var semesterEnd = new Date(semesterTime[5] + ' ' +  semesterTime[4] + ' ' + semesterTime[3]);
			semesterEnd.setDate(semesterEnd.getDate() + 1); // so UNTIL clause works for the last day of semester

			console.log('\n\n\n', chalk.cyan(courseSymbol, ':', courseTitle));

			$(this).find('tbody tr').each(function(j) {
		 		var $row = $(this);
		 		var periodDay = $row.children('td').eq(1).text().trim().toLowerCase()	;
		 		var periodTime = $row.children('td').eq(2).text().trim().split(' ');
				var diffFromStart = (dayValue.indexOf(periodDay) - semesterStart.getDay()).mod(7); // difference from semesterStart date object, with modulo of 7 to wrap around the week
		 		var periodStart = periodTime[0];
		 		var periodEnd = periodTime[2];
				var periodStartDateObj = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[0]);
		 		periodStartDateObj.setDate(periodStartDateObj.getDate() + diffFromStart);
		 		var periodEndDateObj = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[2]);
		 		periodEndDateObj.setDate(periodEndDateObj.getDate() + diffFromStart);
		 		var periodType = $row.children('td').eq(3).text().trim();
		 		var periodLocation = $row.children('td').eq(4).text().trim();

				var eventDescription = 	`${periodDay} ${periodTime.join(' ')} ${periodType} ${periodLocation}`;
				console.log(chalk.yellow('---> Inserting', eventDescription));

				var periodObj = {
					description: courseTitle,
					location: periodLocation,
					summary: courseSymbol + ' - ' + periodType,
					start: {
						dateTime: periodStartDateObj.toISOString(),
						timeZone: 'America/Montreal'
					},
					end: {
						dateTime: periodEndDateObj.toISOString(),
						timeZone: 'America/Montreal'
					},
					recurrence: [
						`RRULE:FREQ=WEEKLY;UNTIL=${semesterEnd.toISOString().slice(0, semesterEnd.toISOString().indexOf('T')).replace(/-/g, '')}` // format is YYYYMMDD
					],
					reminders: {
						useDefault: false,
						overrides: []
					},
					colorId: getColourId(periodType.toLowerCase(), chosenSemesters)
				};

				_gCalendar.insertEvent(gAuth, periodObj, eventDescription);
			});
		});
	}

	function defineEventColours() {
		var colours = {};
		colours['Soft Blue'] = 1;
		colours['Mint Green'] = 2;
		colours['Pale Violet'] = 3;
		colours['Light Red'] = 4;
		colours['Golden Yellow'] = 5;
		colours['Light Orange'] = 6;
		colours['Soft Cyan'] = 7;
		colours['Light Gray'] = 8;
		colours['Powder Blue'] = 9;
		colours['Lime Green'] = 10;
		colours['Vivid Red'] = 11;

		return colours;
	}

// TODO: remove this function?
	function getMonthInt(monthStr) {
		var months = {
			'january': '01',
			'february': '02',
			'march': '03',
			'april': '04',
			'may': '05',
			'june': '06',
			'july': '07',
			'august': '08',
			'september': '09',
			'october': '10',
			'november': '11',
			'december': '12'
		};

		return months[monthStr.toLowerCase()];
	}

	function getColourId(type, chosenSemesters) {
		if (type.includes('lecture'))
			return chosenSemesters.lecColour;
		if (type.includes('lab'))
			return chosenSemesters.labColour;

		return chosenSemesters.dgdTutColour;
	}

	Number.prototype.mod = function(n) {
		return ((this%n)+n)%n;
	};
}