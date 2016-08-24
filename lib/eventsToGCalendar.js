var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var calendar = google.calendar('v3');
const scope = 'https://www.googleapis.com/auth/calendar';
const auth = new googleAuth();
const oauth2Client = new auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);

// oauth2Client.credentials = token;
var _gCalendar = {
  getAuthURL: () => {
    return oauth2Client.generateAuthUrl({
      access_type: 'online',
      scope
    });
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