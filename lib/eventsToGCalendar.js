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
	getAuth: (code, callback) => {
		var newAuthClient = new auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);

		newAuthClient.getToken(code, (err, tokens) => {
			// Now tokens contains an access_token and an optional refresh_token. Save them.
			if (err) {
				console.error('Error getAuth', err)
				callback(null);
			} else {
				newAuthClient.setCredentials(tokens);
				callback(newAuthClient);
			}
		});
	},

	/**
	 * Lists the next 10 events on the user's primary calendar.
	 *
	 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
	 */

	insertEvent: function (auth, event, id, callback, backoff = 1000) {
		calendar.events.insert({
			auth,
			calendarId: 'primary',
			resource: event
		}, (err, response) => {
			if (err && backoff <= 16000) { // exponential-backoff, unless backoff has reached 16s
				setTimeout(() => {
					this.insertEvent(auth, event, id, callback, backoff * 2);
				}, backoff);
			} else if (err) {
				console.error('err', err);
				callback(false);
			} else {
				console.log(`backoff: ${backoff == 1000 ? 0 : backoff / 2}ms`); // show the backoff applied
				callback(true);
			}
		});
	}
}

module.exports = _gCalendar;
