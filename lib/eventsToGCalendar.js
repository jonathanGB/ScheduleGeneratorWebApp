var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var calendar = google.calendar('v3');
const credentials = JSON.parse(fs.readFileSync('lib/client_secret.json', 'utf8')).installed;
const scope = 'https://www.googleapis.com/auth/calendar';

var auth = new googleAuth()
var oauth2Client = new auth.OAuth2(credentials.client_id, credentials.client_secret, credentials.redirect_uris[0]);

// oauth2Client.credentials = token;
var _gCalendar = {
  oauth2Client,
  getToken: () => {
    var authUrl = oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope: SCOPES
    });
    
    return authUrl;
  },

  /**
   * Lists the next 10 events on the user's primary calendar.
   *
   * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
   */

  insertEvent: function (auth, event, eventDescription) {
    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event
    }, function(err, response) {
      if (err) {
        setTimeout(function() {
          calendar.events.insert({
            auth: auth,
            calendarId: 'primary',
            resource: event
          }, function(err, response) {
            if (err)
              console.log(chalk.red(`<--- Failed to insert ${eventDescription} (${event.summary})\n${err}`));
            else
              console.log(chalk.green(`<--- Inserted ${eventDescription} (${event.summary})!`));
          });
        }, 500);
      } else
        console.log(chalk.green(`<--- Inserted ${eventDescription} (${event.summary})!`));
    });
  }
}

module.exports = _gCalendar;