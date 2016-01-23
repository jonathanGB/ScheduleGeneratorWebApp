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
	
	if ($('body').hasClass('logged-in'))
		console.log('good');
	else
		console.log('bad');
});
