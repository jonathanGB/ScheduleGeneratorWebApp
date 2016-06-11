const cheerio = require('cheerio');
var request = require('request');
//request.debug = true;
const inquirer = require('inquirer');
const fs = require('fs');
const _ = require('underscore');
const chalk = require('chalk');


printTitle();

uOttawascheduleCrawler();


/* FUNCTIONS */
function printTitle() {
	const SCHOOL_NAME = "POLY"; // change school name
	const TITLE = SCHOOL_NAME + ' CALENDAR GENERATOR';
	const BORDER = generateLine(TITLE.length, '*');
	const PADDING = generateLine(TITLE.length, ' ');

	console.log();
	console.log(chalk.cyan(BORDER));
	console.log(chalk.cyan(PADDING));
	console.log(chalk.cyan('*'), chalk.white.bold(SCHOOL_NAME, 'CALENDAR GENERATOR'), chalk.cyan('*'));
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

function uOttawascheduleCrawler() {
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

		var curKey = Object.keys(chosenSemesters.semesters)[0];
		var curId = chosenSemesters.semesters[curKey];
		delete chosenSemesters.semesters[curKey];

		console.log('Grabbing schedule of', chalk.magenta(curKey));

		// TODO: CHANGE TIMEOUT WITH ACTUAL SCHEDULE GRABBING/PARSING
		setTimeout(function() {
				grabSchedules(chosenSemesters);
		}, 2000);
	}
}
