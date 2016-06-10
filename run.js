const cheerio = require('cheerio');
var request = require('request');
//request.debug = true;
const inquirer = require('inquirer');
const fs = require('fs');

const SCHOOL_NAME = "UOTTAWA";

console.log();
console.log('===================================');
console.log(SCHOOL_NAME, 'CALENDAR GENERATOR');
console.log('===================================');
console.log();

uOttawascheduleCrawler();



function uOttawascheduleCrawler() {
	console.log("== GRABBING THE FORM ID");

	request({
		url: 'https://uozone2.uottawa.ca/user/login',
		jar: true
	}, function(err, res, body) {
		if (err) throw new Error(err);
		
		var formId = getFormId(body);

		if (!formId)
			throw new Error('Form id not found');

		console.log("== FORM ID GOTTEN\n");

		askUozoneCredentials(function(creds) {
			console.log();
			
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
		 				url: 'https://uozone2.uottawa.ca/academic',
		 				jar: true
		 			}, function(err ,res, body) {
		 				if (err) throw new Error(err);

						fs.writeFileSync('schedule.html', body, 'utf8');		 				
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
				type: 'input',
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
			console.log('Good credentials');
			callback();
		}
		else
			console.log('Bad uoZone credentials');
	}
}

