'use strict';

/* Magic Mirror
 * Module: MMM-Tesla2
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
			headers: { 'User-Agent': 'MMM-Tesla2' }
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
		this.vehicle_data = null;
	},

	getData: function() {
		var self = this;
		
		const vehicleId = this.config.vehicle_id;
		const baseUrl = 'https://owner-api.teslamotors.com/api/1/vehicles/' + vehicleId;

		function getChargeDate(token) {
			request.get({
				url: baseUrl + '/data_request/charge_state',
				headers: { 'Authorization': "Bearer " + token, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla2' }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					self.charge_data = body;
					self.sendSocketNotification("CHARGE_DATA", body);					
				}
			})
		}

		function getDriveStateDate(token) {
			request.get({
				url: baseUrl + '/data_request/drive_state',
				headers: { 'Authorization': "Bearer " + token, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla2' }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					self.drivestate_data = body;
					self.sendSocketNotification("DRIVESTATE_DATA", body);					
				}
			})
		}

		function getVehicleDate(token) {
			request.get({
				url: baseUrl,
				headers: { 'Authorization': "Bearer " + token, 'Content-type': "application/json; charset=utf-8", 'User-Agent': 'MMM-Tesla2' }
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					self.vehicle_data = body;
					self.sendSocketNotification("VEHICLE_DATA", body);					
				}
			})
		}

		if (accessToken === null ) {
			var tempToken = getToken(this.config);
			var localToken = tempToken.then(function(accessToken){
				return accessToken;
			});

			localToken.then(function(token) {
				accessToken = token;
				getChargeDate(token);
				getDriveStateDate(token);
				getVehicleDate(token);
			});
		}
		else {
			getChargeDate(accessToken);
			getDriveStateDate(accessToken);
			getVehicleDate(accessToken);
		}

		setTimeout(function() { self.getData(); }, this.config.refreshInterval);
	},

	socketNotificationReceived: function(notification, payload) {
		console.log("socketNotificationReceived");
		var self = this;
		if (notification === 'CONFIG' && self.started == false) {
			self.config = payload;
			self.sendSocketNotification("STARTED", true);
			self.getData();
			self.started = true;
		} else if (notification == 'CONFIG') {
			self.sendSocketNotification("CHARGE_DATA", self.charge_data);
			self.sendSocketNotification("DRIVESTATE_DATA", self.drivestate_data);
			self.sendSocketNotification("VEHICLE_DATA", self.vehicle_data);
		}
	}
});
