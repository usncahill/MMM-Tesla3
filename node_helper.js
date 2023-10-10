'use strict';

/* Magic Mirror
 * Module: MMM-Tesla3
 *
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
var fs = require('fs');
var request = require('request');
var accessToken = null;

module.exports = NodeHelper.create({

    start: function() {
        this.started = false;
        this.config = {};
        this.vehicle_data = {};
        this.vehicles = {};
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        
        if (notification === 'VEHICLE') {
            self.config[payload.vehicleIndex] = payload;
            // only the first module should run getVehicles
            if (!self.started) {
                self.started = true;
                self.getVehicles(vehicleIndex);
            }
        } else if (notification === 'DATA') {
            self.getData(payload.vehicleIndex);
        }
    },

    getVehicles: function(vehicleIndex) {
        var self = this;
        const baseUrl = 'https://owner-api.teslamotors.com/api/1/vehicles';
        
        if (accessToken === null) {
            self.refreshToken(function(accessToken) {
                getVehicleList(accessToken);
            });
        } else {
            getVehicleList(accessToken);
        }

        function getVehicleList(token) {
            request.get({
                url: baseUrl,
                headers: { 'Authorization': 'Bearer ' + token.access_token, 
                            'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    for (let i = 0; i < JSON.parse(body).count; i++) {
                        self.vehicles[i] = JSON.parse(body).response[i];
                        self.sendSocketNotification('VEHICLE: [' + i + ']', self.vehicles[i]);
                    }
                    
                    self.sendSocketNotification('READY', true);
                } else {                    
                    if (JSON.parse(body).error === 'invalid bearer token') {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: access token got old; refreshing');
                        self.refreshToken(function(newtoken) { getVehicleList(newtoken); });
                    } else if (JSON.parse(body).includes('timeout')) {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: timed out during vehicle list retrieval; trying again in 1 minute.');
                        setTimeout(function() { getVehicleList(token); }, 1000 * 60);
                    } else {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: unhandled error during vehicle list retrieval\n'+body);
                        return; //failed to update
                    }
                }
            });
        }
    },
    
    getData: function(vehicleIndex) {
        var self = this;
        const baseUrl = 'https://owner-api.teslamotors.com/api/1/vehicles/' + self.vehicles[vehicleIndex].id;
        
        if (accessToken === null) {
            this.refreshToken(function(accessToken) {
                getVehicleData(accessToken);
            });
        } else {
            getVehicleData(accessToken);
        }

        function getVehicleData(token) {
            request.get({
                url: baseUrl + '/vehicle_data',
                headers: { 'Authorization': 'Bearer ' + token.access_token, 
                            'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                        self.vehicle_data[vehicleIndex] = JSON.parse(body).response;
                        updateRefreshInterval(vehicleIndex);
                        self.sendSocketNotification('DATA: [' + vehicleIndex + ']', self.vehicle_data[vehicleIndex]);
                } else {
                    if (JSON.parse(body).error.includes('vehicle unavailable')) {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: vehicle [' + vehicleIndex + '] is asleep; attempting wake');
                        wakeVehicle(token);
                    } else if (JSON.parse(body).error === 'invalid bearer token') {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: access token got old; refreshing');
                        accessToken = null;
                        self.getData(vehicleIndex);
                    } else if (JSON.parse(body).error.includes('timeout')) {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: timed out during data retrieval for [' + vehicleIndex + ']; trying again in 1 minute.');
                        setTimeout(function() { self.getData(vehicleIndex); }, 1000 * 60);
                    } else {
                        if (self.config[vehicleIndex].showVerboseConsole)
                            console.log('MMM-Tesla3: unhandled error during data retrieval\n'+body);
                        return; //failed to update
                    }
                }
            });
        }
        
        function wakeVehicle(token) {
            request.post({
                url: baseUrl + '/wake_up',
                headers: { 'Authorization': 'Bearer ' + token.access_token, 
                            'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    // send back waking response which contains some interim info
                    self.sendSocketNotification('WAKING: [' + vehicleIndex + ']', JSON.parse(body).response);
                    setTimeout(function() { self.getData(vehicleIndex); }, 1000 * 60);
                } else {
                    if (self.config[vehicleIndex].showVerboseConsole)
                        console.log('MMM-Tesla3: vehicle [' + vehicleIndex + '] failed to wake\n'+body);
                    return;
                }
            });
        }

        function updateRefreshInterval(vehicleIndex) {
            if(self.vehicle_data[vehicleIndex].charge_state.charging_state === 'charging') {
                setTimeout(function() { self.getData(vehicleIndex); }, 1000 * 60 * (self.config[vehicleIndex].refreshIntervalCharging || 5));
            } else {
                setTimeout(function() { self.getData(vehicleIndex); }, 1000 * 60 * (self.config[vehicleIndex].refreshInterval || 15));
            }
        }
    },

    refreshToken: function(callback) {
        var self = this;
        
        // original token.json need only contain [{refresh_token: "token characters"}]
        accessToken = JSON.parse(fs.readFileSync(self.path + '/token.json'));
        // at this point, accessToken.refresh_token is the only parameter of interest
        
        const credentials = {
            grant_type: 'refresh_token',
            refresh_token: accessToken.refresh_token,
            client_id: 'ownerapi',
            scope: 'openid email offline_access'
        };
        const baseUrl = 'https://auth.tesla.com';
        
        request.post({
                url: baseUrl + '/oauth2/v3/token',
                headers: { 'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' },
                body: JSON.stringify(credentials)
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // WARNING: 
                // this will write to the disk at least every 8 hours when accessToken.access_token goes stale
                // the token.json "refresh_token" will likely not work forever and need to be updated, hence the write
                fs.writeFileSync(self.path + '/token.json', body);
                accessToken = JSON.parse(body);
                callback(accessToken);
            } else {
                if (self.config[vehicleIndex].showVerboseConsole)
                    console.log('MMM-Tesla3: Error during access_token update: ' + body);
            }
        });
    }
});
