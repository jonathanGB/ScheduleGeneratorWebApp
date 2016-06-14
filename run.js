const cheerio = require('cheerio');
var request = require('request');
//request.debug = true;
const inquirer = require('inquirer');
const fs = require('fs');
const _ = require('underscore');
const chalk = require('chalk');
const spawn = require('child_process').spawn;


printTitle('UOTTAWA'); // change for different school

var insertProcess = spawn('node', ['eventsToGCalendar.js']); // child process to insert events asynchronously

uOttawaScheduleCrawler();


/* FUNCTIONS */
function printTitle(schoolName) {
	const TITLE = schoolName + ' CALENDAR GENERATOR';
	const BORDER = generateLine(TITLE.length, '*');
	const PADDING = generateLine(TITLE.length, ' ');

	console.log();
	console.log(chalk.cyan(BORDER));
	console.log(chalk.cyan(PADDING));
	console.log(chalk.cyan('*'), chalk.white.bold(schoolName, 'CALENDAR GENERATOR'), chalk.cyan('*'));
	console.log(chalk.cyan(PADDING));
	console.log(chalk.cyan(BORDER));
	console.log();

	function generateLine(len, char) {
		var line = '*';

		for (var i = 0; i < len + 2; i++) // + 4 for padding
			line += char;

		return line + '*';
	}
}

function uOttawaScheduleCrawler() {
	console.log("GRABBING THE FORM ID");

	request({
		url: 'https://uozone2.uottawa.ca/user/login',
		jar: true
	}, function(err, res, body) {
		if (err) throw new Error(err);

		var formId = getFormId(body);

		if (!formId)
			throw new Error('Form id not found');

		console.log("FORM ID RETRIEVED\n");

		askUozoneCredentials(function(creds) {
		 	request({
		 		method: 'post',
		 		url: 'https://uozone2.uottawa.ca/user/login',
		 		qs: {
		 			language: 'en'
		 		},
		 		jar: true,
		 		form: {
		 			name: creds.username,
		 			pass: creds.password,
		 			form_build_id: formId,
		 			form_id: 'user_login_block',
		 			op: 'Login'
		 		}
		 	}, function(err, res, body) {
		 		if (err) throw new Error(err);

		 		verifyUozoneLogin(body, function() {
		 			request({
		 				url: 'https://uozone2.uottawa.ca/academic?language=en',
		 				jar: true
		 			}, function(err ,res, body) {
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


	function getFormId(landingPage) {
		var $ = cheerio.load(landingPage);
		return $('[name=form_build_id]').val();
	}

	function askUozoneCredentials(callback) {
		inquirer.prompt([
			{
				type: 'input',
				name: 'username',
				message: 'uOzone username: ',
				validate: function(input) {
					return isNaN(input) ?
						'username given is not a number':
						true;
				}
			},
			{
				type: 'password',
				name: 'password',
				message: 'uOzone password: '
			}
		]).then(function (answers) {
			callback(answers);
		});
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
		console.log(chosenSemesters);
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
			grabSchedules(chosenSemesters); // TODO: put as callback to parseSemesterSchedule
		});
	}

	function parseSemesterSchedule($, chosenSemesters) {
		var dayValue = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']; // diff from start

		$('div.view-content table').each(function() {
	  	var caption = $(this).children('caption').text().trim();
	  	var courseSymbol = caption.substr(0, 7);
	  	var courseTitle = caption.slice(8, caption.lastIndexOf('(')).trim();
	  	var semesterTime = caption.slice(caption.lastIndexOf('(') + 1, caption.lastIndexOf(')')).split(' ');
			var semesterStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0]);
		 	var semesterEnd = new Date(semesterTime[5] + ' ' +  semesterTime[4] + ' ' + semesterTime[3]);
			semesterEnd.setDate(semesterEnd.getDate() + 1); // so UNTIL clause works for the last day of semester

			console.log('\n', chalk.cyan(courseSymbol, ':', courseTitle));

			$(this).find('tbody tr').each(function() {
		 		var $row = $(this);
		 		var periodDay = $row.children('td').eq(1).text().trim().toLowerCase()	;
		 		var periodTime = $row.children('td').eq(2).text().trim().split(' ');
				var diffFromStart = dayValue.indexOf(periodDay) - semesterStart.getDay(); // difference from semesterStart date object
		 		var periodStart = periodTime[0];
		 		var periodEnd = periodTime[2];
				var periodStartDateObj = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[0]);
		 		periodStartDateObj.setDate(periodStartDateObj.getDate() + diffFromStart);
		 		var periodEndDateObj = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[2]);
		 		periodEndDateObj.setDate(periodEndDateObj.getDate() + diffFromStart);
		 		var periodType = $row.children('td').eq(3).text().trim();
		 		var periodLocation = $row.children('td').eq(4).text().trim();

				console.log(chalk.green('--->', periodDay, periodTime.join(' '), periodType, periodLocation))

				var periodObj = {
					location: periodLocation,
					summary: courseSymbol + ' - ' + periodType,
					start: {
						dateTime: periodStartDateObj.toISOString().slice(0, -1),
						timeZone: 'America/Montreal'
					},
					end: {
						dateTime: periodEndDateObj.toISOString().slice(0, -1),
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

				console.log(periodObj);
				// TODO: insert events in GCalendar by insertProcess.stdin.write(JSON.stringify(periodObj));
				// TODO: add insertProcess.stdout.on('data', function(data) {}) to listen back
				// TODO: modify child process to insert data to GCalendar
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
}
