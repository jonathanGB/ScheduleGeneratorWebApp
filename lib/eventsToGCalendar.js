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
				oauth2Client.setCredentials(tokens);
				callback(oauth2Client);
			}
		});
	},

	/**
	 * Lists the next 10 events on the user's primary calendar.
	 *
	 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
	 */

	insertEvent: function (auth, event, id, callback) {
		// TODO: refactor to use an async loop
		calendar.events.insert({
			auth,
			calendarId: 'primary',
			resource: event
		}, (err, response) => {
			if (err) { // 2 layers of exponential backoff
				setTimeout(() => {
					calendar.events.insert({
						auth,
						calendarId: 'primary',
						resource: event
					}, (err, response) => {
						if (err) {
							setTimeout(() => {
								calendar.events.insert({
									auth,
									calendarId: 'primary',
									ressource: event
								}, (err, response) => {
									if (err) {
										console.error('err', err)
										callback(false)
									} else {
										callback(true)
									}
								})
							}, 1000)
						} else
							callback(true);
					});
				}, 500);
			} else {
				callback(true);
			}
		});
	}
}

module.exports = _gCalendar;
