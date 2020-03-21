'use strict';

/* Magic Mirror
 * Module: MMM-Tesla
 *
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
var request = require('request');
var moment = require('moment');
var accessToken = null;

function getToken(config) {
	try {
		const token = getTokenInternal(config);
		return token;
    } catch (err) {
		console.log(err);
		return "abc";
	}
}

async function getTokenInternal(config) {

	// Set the configuration settings
	const credentials = {
		client: {
			id: config.client_id,
			secret: config.client_secret
		},
		auth: {
			tokenHost: 'https://owner-api.teslamotors.com',
			tokenPath: '/oauth/token'
		  },
		  http: {
			headers: { 'User-Agent': 'MMM-Tesla' }
		}
	};
		
	const oauth2 = require('simple-oauth2').create(credentials);

	const tokenConfig = {
		email: config.email,
		password: config.password,
		grant_type: 'password',
		client_secret: config.client_secret,
		client_id: config.client_id
	};

	try {
		var tokenObject = await oauth2.ownerPassword.getToken(tokenConfig);
		return tokenObject.access_token;
	} catch (error) {
		console.log('Access Token Error', error.message);
	}
}

module.exports = NodeHelper.create({

	start: function() {
		this.started = false;
		this.config = null;
		this.drivestate_data = null;
		this.charge_data = null;
	},

	getData: function() {
		var self = this;
		var tempToken;
		
		const base_data_url = 'https://owner-api.teslamotors.com/api/1/vehicles/' + this.config.vehicle_id;

		if (accessToken === null ) {
			tempToken = getToken(this.config).then(function(accessToken) {
				request({
					url: base_data_url + '/data_request/charge_state',
					method: 'GET',
					headers: { 'Authorization': "Bearer " + accessToken, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla' }
				}, function (error, response, body) {
					console.log('Polling charge state'); // Print the HTML 
					if (!error && response.statusCode == 200) {
						self.charge_data = body;
						self.sendSocketNotification("CHARGE_DATA", body);
						request({
							url: base_data_url + '/data_request/drive_state',
							method: 'GET',
							headers: { 'Authorization': "Bearer " + accessToken, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla' }
						}, function (error, response, body) {
							console.log('Polling drive state');
							self.drivestate_data = body;
							if (!error && response.statusCode == 200) {
								self.sendSocketNotification("DRIVESTATE_DATA", body);
							}
						})
					} else {
						console.log(accessToken);
						console.log('Error: ' + error)
					}
				})
				return accessToken;
			});
			accessToken = tempToken;
		}
		else {
			/*
			accessToken.then(function(accessToken){
				request({
					url: base_data_url + '/data_request/charge_state',
					method: 'GET',
					headers: { 'Authorization': "Bearer " + accessToken, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla' }
				}, function (error, response, body) {
					console.log('Polling charge state'); // Print the HTML 
					if (!error && response.statusCode == 200) {
						self.charge_data = body;
						self.sendSocketNotification("CHARGE_DATA", body);
						request({
							url: base_data_url + '/data_request/drive_state',
							method: 'GET',
							headers: { 'Authorization': "Bearer " + accessToken, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla' }
						}, function (error, response, body) {
							console.log('Polling drive state');
							self.drivestate_data = body;
							if (!error && response.statusCode == 200) {
								self.sendSocketNotification("DRIVESTATE_DATA", body);
							}
						})
					} else {
						console.log(accessToken);
						console.log('Error: ' + error)
					}
				})
			}) */
		}

		setTimeout(function() { self.getData(); }, this.config.refreshInterval);
	},

	socketNotificationReceived: function(notification, payload) {
		var self = this;
		if (notification === 'CONFIG' && self.started == false) {
			self.config = payload;
			self.sendSocketNotification("STARTED", true);
			self.getData();
			self.started = true;
		} else if (notification == 'CONFIG') {
			self.sendSocketNotification("CHARGE_DATA", self.charge_data);
			self.sendSocketNotification("DRIVESTATE_DATA", self.drivestate_data);
		}
	}
});
