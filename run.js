const cheerio = require('cheerio');
var request = require('request');
//request.debug = true;
const inquirer = require('inquirer');
const fs = require('fs');
const _ = require('underscore');
const chalk = require('chalk');


printTitle('UOTTAWA'); // change for different school

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

		console.log("FORM ID GOTTEN\n");

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
							} // TODO: another prompt here, ask for colours depending of periodType
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

		var curKey = Object.keys(chosenSemesters.semesters)[0];
		var curId = chosenSemesters.semesters[curKey];
		delete chosenSemesters.semesters[curKey];

		console.log('\n\nGrabbing schedule of', chalk.magenta(curKey));

		// TODO: CHANGE TIMEOUT WITH ACTUAL SCHEDULE GRABBING/PARSING
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
			fs.writeFileSync(curId + '.html', body, 'utf8');
			parseSemesterSchedule($);
			grabSchedules(chosenSemesters);
		});
	}

	function parseSemesterSchedule($) {
		$('div.view-content table').each(function() {
	  	var caption = $(this).children('caption').text().trim();
	  	var courseSymbol = caption.substr(0, 7);
	  	var courseTitle = caption.slice(8, caption.lastIndexOf('(')).trim();
	  	var semesterTime = caption.slice(caption.lastIndexOf('(') + 1, caption.lastIndexOf(')')).split(' ');
	  	var semesterStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0]);
	  	var semesterEnd = new Date(semesterTime[5] + ' ' +  semesterTime[4] + ' ' + semesterTime[3] + ' 23:59');

			console.log('\n', chalk.cyan(courseSymbol, ':', courseTitle));

			$(this).find('tbody tr').each(function() {
		 		var $row = $(this);
		 		var periodDay = $row.children('td').eq(1).text().trim();
		 		var periodTime = $row.children('td').eq(2).text().trim().split(' ');
		 		var periodStart = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[0]);
		 		var periodEnd = new Date(semesterTime[5] + ' ' + semesterTime[1] + ' ' + semesterTime[0] + ' ' + periodTime[2]);
		 		var periodType = $row.children('td').eq(3).text().trim();
		 		var periodLocation = $row.children('td').eq(4).text().trim();

				console.log(chalk.green('--->', periodDay, periodTime.join(' '), periodType, periodLocation))

				// TODO: create period object, add to array of periods
				// TODO: confirm, then insert events in GCalendar
			});
		});
	}
}
