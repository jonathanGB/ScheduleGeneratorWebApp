var cheerio = require('cheerio');
var fs = require('fs');

var output;

process.stdin.on('readable', function() {
  var chunk = process.stdin.read();

  if (chunk !== null)
  	output += chunk;
});

process.stdin.on('end', function() {
	var $ = cheerio.load(output);
	var formId = $('[name=form_build_id]').val();

	console.log(formId);
});
