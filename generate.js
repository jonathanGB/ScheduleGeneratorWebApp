var request = require('request');
require('request-debug')(request);
const cheerio = require('cheerio');
var fs = require('fs');

if (process.argv.length !== 4) {
	console.log("Generator requires username and password in uoZone");
	console.log("\t--> Valid format is: node generator <USERNAME> <PASSWORD>");
} else {
	var credentials = {
		name: process.argv[2],
		pass: process.argv[3]
	};

	console.log(credentials);

	// request.defaults({jar: true});

	// URL: GET: https://uozone.uottawa.ca/user/login
	// POST: https://uozone2.uottawa.ca/user/login?destination=/&language=en
	// parameters: 
	// name: *student number*
	// pass: *password*
	// form_build_id: (form_id from GET request)
	// form_id: user_login_block
	// op: Login

	request('https://uozone.uottawa.ca/user/login', function(err, res, body) {
		if (!err) {
			var $ = cheerio.load(body);
			var formId = $('[name=form_build_id]').val();
			console.log(formId);

			var options = { method: 'POST',
			  url: 'https://uozone2.uottawa.ca/user/login',
			  qs: { destination: 'academic/' },
			  headers: 
			   { 'content-type': 'application/x-www-form-urlencoded',
			     // 'postman-token': '33af3c99-edf6-945f-fc49-862fc79a0516',
			     'cache-control': 'no-cache' },
			  form: 
			   { name: credentials.name,
			     pass: credentials.pass,
			     form_build_id: formId,
			     form_id: 'user_login_block',
			     op: 'Login',
			     language: 'en' } };

			request(options, function (error, response, body) {
			  if (error) throw new Error(error);

			  console.log(body);
			});
		}
	});
}

