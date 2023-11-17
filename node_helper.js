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
        this.ready = false;     
        
        this.config = {};       // mimics the main .js config
        this.vehicle_data = {}; // saves vehicle_data for each config vehicleIndex received
        this.vehicles = {};     // saves each vehicle in Tesla API vehicle list
        this.lastUpdates = {};  // saves checkUpdate related info: avoiding vamp drain by letting car sleep
        
        setInterval(() => {this.checkUpdates();}, 60000);
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        
        if (notification === 'START') {
            self.config[payload.vehicleIndex] = payload;
            self.lastUpdates[payload.vehicleIndex] = {
                wake: Date.now() - 24 * 60 * 60000,
                refresh: Date.now() - 24 * 60 * 60000,
            };
            // only the first module should run getVehicles
            if (!self.started) {
                self.started = true;
                self.getVehicles(payload.vehicleIndex);
            }
        }
    },

    checkUpdates: function() {
        var self = this;
        var gotVehicles = false;
        
        if (!self.ready) { return; }
        
        // loop through all the vehicles on the account, updating per their intervals
        Object.keys(self.lastUpdates).forEach(i => {
            if (Date.now() - self.lastUpdates[i].refresh > self.config[i].refreshPeriod * 60000) {
                self.lastUpdates[i].wakeAttemptCount = 0;
                self.lastUpdates[i].allowWake = false;
                self.lastUpdates[i].wakePeriod = getWakePeriod(i);
                
                // allowWake if user chose short wakePeriod or enough time has passed
                if (self.lastUpdates[i].wakePeriod <= 15 || 
                    Date.now() - self.lastUpdates[i].wake > self.lastUpdates[i].wakePeriod * 60000) { self.lastUpdates[i].allowWake = true; }
                
                // check whether vehicles are awake before getting data
                Promise.resolve()
                .then(() => {
                    if (!gotVehicles) { gotVehicles = true; self.getVehicles(i); }
                }).then(() => {
                    // if user used low wakePeriod, dont worry about keepnig the car awake with data requests
                    // otherwise, only get data if driving or if the car has have enough time to fall asleep
                    if ((self.lastUpdates[i].wakePeriod <= 15) || 
                        (self.vehicles[i].state === "driving") || 
                        ((self.vehicles[i].state === "online" || self.lastUpdates[i].allowWake) && Date.now() - self.lastUpdates[i].refresh > 15 * 60000)) { self.getData(i); }
                    self.lastUpdates[i].refresh = Date.now();
                });
            }
        });
        
        function getWakePeriod(vehicleIndex) {
            var now = (new Date()).toTimeString().substr(0,5).replace(":","");
            var start; var end;
            var wakeInts = self.config[vehicleIndex].wakeIntervals;
            
            for (let i = 0; i < wakeInts.length; i++) {
                if (('start' in wakeInts[i]) && ('end' in wakeInts[i]) && ('period' in wakeInts[i])) {
                    start = parseInt(wakeInts[i].start, 10);
                    end = parseInt(wakeInts[i].end, 10);
                    
                    if ((now > start && now < end) ||
                        (start > end && now > start) ||
                        (start > end && now < end)) {
                        return wakeInts[i].period; // found the period for the current time!
                    }
                }
            }
            
            return self.config[vehicleIndex].wakePeriod; // use main config #; couldnt find a better period
        }
    },

    getVehicles: function(vehicleIndex) {
        var self = this;
        const baseUrl = 'https://owner-api.teslamotors.com/api/1/vehicles';
        var verb = self.config[vehicleIndex].showVerboseConsole;
        
        if (accessToken === null) {
            self.refreshToken(() => getVehicleList());
        } else {
            getVehicleList();
        }
        
        function getVehicleList() {
            request.get({
                url: baseUrl,
                headers: { 'Authorization': 'Bearer ' + accessToken.access_token, 
                            'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    for (let i = 0; i < JSON.parse(body).count; i++) {
                        self.vehicles[i] = JSON.parse(body).response[i];
                        self.sendSocketNotification('VEHICLE: [' + i + ']', self.vehicles[i]);
                    }
                    
                    if (!self.ready) { self.ready = true; self.checkUpdates(); } // short-cycle the checkUpdates timer
                    
                    return 0;
                } else {
                    if (error) {
                        if (error.toString().includes('ENOTFOUND') || error.toString().includes('ETIMEDOUT') || error.toString().includes('ESOCKETTIMEDOUT')) {
                            if (verb) { console.log('MMM-Tesla3: timed out connecting to tesla.com. Check internet connection. \nerror:'+error); }
                            return 1;
                        } 
                    } 
                    
                    if (body) {
                        if (JSON.parse(body).error === 'invalid bearer token') {
                            if (verb) { console.log('MMM-Tesla3: access token got old; refreshing'); }
                            self.refreshToken(() => self.getVehicles(vehicleIndex));
                            return 2;
                        }
                        if (JSON.parse(body).includes('timeout')) {
                            if (verb) { console.log('MMM-Tesla3: timed out during vehicle list retrieval; trying again in 1 minute.'); }
                            setTimeout(() => self.getVehicles(vehicleIndex), 1000 * 60);
                            return 3;
                        }
                    }
                    
                    console.log('MMM-Tesla3: Unhandled error during vehicle list update:\nbody:'+body+'\nerror:'+error);
                    return 99;
                }
            });
        }
    },
    
    getData: function(vehicleIndex) {
        var self = this;
        const baseUrl = 'https://owner-api.teslamotors.com/api/1/vehicles/' + self.vehicles[vehicleIndex].id;
        var verb = self.config[vehicleIndex].showVerboseConsole;
        
        if (accessToken === null) {
            self.refreshToken(() => getVehicleData());
        } else {
            getVehicleData();
        }

        function getVehicleData() {
            request.get({
                url: baseUrl + '/vehicle_data',
                headers: { 'Authorization': 'Bearer ' + accessToken.access_token, 
                            'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    self.vehicle_data[vehicleIndex] = JSON.parse(body).response;
                    self.sendSocketNotification('DATA: [' + vehicleIndex + ']', self.vehicle_data[vehicleIndex]);
                    return 0;
                } else {
                    if (error) {
                        if (error.toString().includes('ENOTFOUND') || error.toString().includes('ETIMEDOUT') || error.toString().includes('ESOCKETTIMEDOUT')) {
                            if (verb) { console.log('MMM-Tesla3: timed out connecting to tesla.com. Check internet connection. \nerror:'+error); }
                            return 1;
                        }
                    }
                    
                    if (body) {
                        if (JSON.parse(body).error === 'invalid bearer token') {
                            if (verb) { console.log('MMM-Tesla3: access token got old; refreshing'); }
                            self.refreshToken(() => self.getData(vehicleIndex));
                            return 2;
                        } 
                        if (JSON.parse(body).error.includes('timeout')) {
                            if (verb) { console.log('MMM-Tesla3: timed out during data retrieval for [' + vehicleIndex + ']; trying again in 1 minute.'); }
                            setTimeout(() => self.getData(vehicleIndex), 1000 * 60);
                            return 3;
                        }
                        if (JSON.parse(body).error.includes('vehicle unavailable')) {
                            if (self.lastUpdates[vehicleIndex].allowWake) {
                                self.lastUpdates[vehicleIndex].wakeAttemptCount += 1;
                                
                                if (self.lastUpdates[vehicleIndex].wakeAttemptCount > 5) {
                                    if (verb) { console.log('MMM-Tesla3: vehicle [' + vehicleIndex + '] failed to wake after 5 attempts'); }
                                    return 5;
                                }
                                if (verb) { console.log('MMM-Tesla3: vehicle [' + vehicleIndex + '] is asleep; attempting wake'); }
                                
                                self.lastUpdates[vehicleIndex].wake = Date.now();
                                wakeVehicle(() => self.getData(vehicleIndex));
                            }
                            return 4;
                        }
                    }
                    
                    console.log('MMM-Tesla3: unhandled error during vehicle [' + vehicleIndex + '] data retrieval\nbody:'+body+'\nerror:'+error);
                    return 99; //failed to update
                }
            });
        }
        
        function wakeVehicle(callback) {
            request.post({
                url: baseUrl + '/wake_up',
                headers: { 'Authorization': 'Bearer ' + accessToken.access_token, 
                            'Content-type': 'application/json', 
                            'User-Agent': 'MMM-Tesla3' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    // send back waking response which contains some interim info
                    self.sendSocketNotification('WAKING: [' + vehicleIndex + ']', JSON.parse(body).response);
                    setTimeout(callback, 60000);
                } else {
                    console.log('MMM-Tesla3: unhandled error during vehicle [' + vehicleIndex + '] wake\nbody:'+body+'\nerror:'+error);
                    return 99; //failed to update
                }
            });
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
                // this writes to the disk at least every 8 hours when accessToken.access_token goes stale
                // token.json "refresh_token" will not work forever, so this write keeps refresh_token updated with access_token
                fs.writeFileSync(self.path + '/token.json', body);
                accessToken = JSON.parse(body);
                callback();
            } else {
                if (response) {
                    if (reponse.statuscode == 400) {
                        console.log('MMM-Tesla3: Fatal error during access_token request. Ensure a valid refresh_token has been pasted into token.json and that the file is formatted in valid JSON (i.e. {"refresh_token":"your refresh token here, e.g. ey...."} and restart. If this was a previously working module but has been offline for a while, your refresh_token may have gone stale.');
                        return 1;
                    }
                }
                if (error) {
                    if (error.toString().includes('ENOTFOUND') || error.toString().includes('ETIMEDOUT') || error.toString().includes('ESOCKETTIMEDOUT')) {
                        console.log('MMM-Tesla3: timed out connecting to tesla.com. Check internet connection. \nerror:'+error);
                        return 1;
                    }
                }

                console.log('MMM-Tesla3: Unhandled error during access_token update:\nbody:'+body+'\nerror:'+error);
                return 99;
            }
        });
    }
});
