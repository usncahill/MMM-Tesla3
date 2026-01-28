'use strict';

/* Magic Mirror
 * Module: MMM-Tesla3
 *
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
var fs = require('fs');
var request = require('request');

var clientId = null;
var accessToken = null;
const urlData = 'https://fleet-api.prd.na.vn.cloud.tesla.com';
const urlAuth = 'https://fleet-auth.prd.vn.cloud.tesla.com';
const minRefreshPeriod = 15;
const minWakePeriod = 60;
const wakeDelay = 4;
const wakeAttemptCountLimit = 3;

module.exports = NodeHelper.create({

    start: function() {
        this.started = false;
        this.ready = false;
        
        this.nextTokenUpdate = Date.now();  // force a token update on startup
        this.config = {};       // mimics the main .js config
        this.vehicle_data = {}; // saves vehicle_data for each config vehicleIndex received
        this.vehicles = {};     // saves each vehicle in Tesla API vehicle list
        this.lastUpdates = {};  // saves checkUpdate related info: avoiding vamp drain by letting car sleep
        
        setInterval(() => { this.checkUpdates(); }, 60000);
    },

    socketNotificationReceived: function(notification, payload) {
        var self = this;
        
        if (notification === 'START') {
            // set up car to be updated on first checkUpdates pass
            self.config[payload.vehicleIndex] = payload;
            clientId = payload.clientId;
            
            //do not allow refresh and wake periods below a hard limit
            self.config[payload.vehicleIndex].refreshPeriod = Math.max(payload.refreshPeriod, minRefreshPeriod);
            self.config[payload.vehicleIndex].wakePeriod = Math.max(payload.wakePeriod, minWakePeriod);
            self.lastUpdates[payload.vehicleIndex] = {
                wake: Date.now() - 24 * 60 * 60000,
                data: Date.now() - 24 * 60 * 60000,
                refresh: Date.now() - 24 * 60 * 60000,
                isWaking: false
            };
            // only the first module should run getVehicles
            if (!self.started) {
                self.started = true;
                self.refreshToken(() => { self.getVehicles(payload.vehicleIndex); });
            }
        }
    },

    checkUpdates: function() {
        var self = this;
        var gotVehicles = false;
        
        if (!self.ready) { return; }
        if (Date.now() > self.nextTokenUpdate) { self.refreshToken(null); }
        
        // need to wait for this to complete before checking whether to get data
        Promise.resolve()
        .then(() => {
            // loop through all the vehicles on the account, checking whether to refresh; if yes, getVehicles
            for (const i of Object.keys(self.lastUpdates)) {
                const verb = self.config[i].showVerboseConsole;
                if (!self.lastUpdates[i].isWaking) { continue; } // dont refresh a waking vehicle
                
                // if any vehicles want a refresh, get the vehicle list to see if they are awake to get data inside the wakePeriod
                if (Date.now() - self.lastUpdates[i].refresh > self.config[i].refreshPeriod * 60000) {
                    if (!gotVehicles) { gotVehicles = true; self.getVehicles(i); }
                    break; //stop parsing list once one vehicle gets vehicles
                }
            }
        }).then(() => {
            if (gotVehicles) {
                for (const i of Object.keys(self.lastUpdates)) {
                    var verb = self.config[i].showVerboseConsole;
                    
                    if (!self.lastUpdates[i].isWaking) { continue; } // dont refresh a waking vehicle
                    
                    if (Date.now() - self.lastUpdates[i].refresh > self.config[i].refreshPeriod * 60000) {
                        self.lastUpdates[i].allowWake = false;
                        self.lastUpdates[i].wakePeriod = getWakePeriod(i);
                        self.lastUpdates[i].refresh = Date.now();
                        
                        // allowWake if user chose short wakePeriod or enough time has passed
                        if (self.lastUpdates[i].wakePeriod <= 10 || 
                            Date.now() - self.lastUpdates[i].wake > self.lastUpdates[i].wakePeriod * 60000) { self.lastUpdates[i].allowWake = true; }
                        
                        // if cars asleep/offline and allowed to awake, wake_up
                        if (self.lastUpdates[i].allowWake && (self.vehicles[i].state === "asleep" || self.vehicles[i].state === "offline")) {
                            self.lastUpdates[i].wakeAttemptCount += 1;
                            
                            if (self.lastUpdates[i].wakeAttemptCount > wakeAttemptCountLimit) {
                                if (verb) { console.log('MMM-Tesla3: vehicle [' + i + '] failed to wake after ' + wakeAttemptCountLimit + ' attempts'); }
                                self.lastUpdates[i].wake = Date.now(); // dont attempt again until next wakePeriod to prevent excessive wake
                                self.lastUpdates[i].wakeAttemptCount = 0;
                                self.lastUpdates[i].isWaking = false;
                                return 5;
                            } else {
                                if (verb) { console.log('MMM-Tesla3: vehicle [' + i + '] is ' + self.vehicles[i].state + '; attempting wake'); }
                                self.lastUpdates[i].wake = Date.now();
                                self.lastUpdates[i].isWaking = true;
                                self.wakeVehicle(i, () => { self.[i].isWaking = false; } );
                            }
                        // if user used low wakePeriod, dont worry about keeping the car awake with data requests
                        // otherwise, only get data if driving or if the car has had enough time to fall asleep
                        } else if ((self.lastUpdates[i].wakePeriod <= 15) || 
                            (self.vehicles[i].state === "driving") || 
                            ((self.vehicles[i].state === "online") && 
                            Date.now() - self.lastUpdates[i].data > 15 * 60000)) { 
                            if (self.lastUpdates[i].wakeAttemptCount > 0 ) {
                                if (verb) { console.log('MMM-Tesla3: vehicle [' + i + '] woke up'); }
                                self.lastUpdates[i].wakeAttemptCount = 0;
                            }
                            
                            self.getData(i); 
                        }
                    }
                }
            }
        }).catch((error) => {
            // do nothing; the error likely showed a console.log
        });
        
        function getWakePeriod(vehicleIndex) {
            var now = parseInt((new Date()).toTimeString().substr(0,5).replace(":",""));
            var start; var end;
            var wakeInts = self.config[vehicleIndex].wakeIntervals;
            
            for (let i = 0; i < wakeInts.length; i++) {
                if (('start' in wakeInts[i]) && ('end' in wakeInts[i]) && ('period' in wakeInts[i])) {
                    start = parseInt(wakeInts[i].start, 10);
                    end = parseInt(wakeInts[i].end, 10);
                    
                    if ((now > start && now < end) ||
                        (start > end && now > start) ||
                        (start > end && now < end)) {
                        return Math.max(wakeInts[i].period, minWakePeriod); // found the period for the current time
                    }
                }
            }
            
            return self.config[vehicleIndex].wakePeriod; // use main config #; couldnt find a better period
        }
    },

    getVehicles: function(vehicleIndex) {
        var self = this;
        var verb = self.config[vehicleIndex].showVerboseConsole;
        
        goGetVehicleList();
        
        function goGetVehicleList() {
            request.get({
                url: urlData + '/api/1/vehicles',
                headers: { 'Authorization': 'Bearer ' + accessToken.access_token, 
                           'Content-type': 'application/json' }
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
                        if (JSON.parse(body).error.includes('timeout')) {
                            if (verb) { console.log('MMM-Tesla3: timed out during vehicle list retrieval; trying again in 15 minute.'); }
                            setTimeout(() => self.getVehicles(vehicleIndex), 15 * 60000);
                            return 3;
                        }
                        if (JSON.parse(body).error.includes('account disabled: EXCEEDED_LIMIT')) {
                            if (verb) { console.log('MMM-Tesla3: error during vehicle list retrieval for [' + vehicleIndex + '] account disabled: EXCEEDED_LIMIT. \n' +
                                                 'Consider raising limit or reducing wakePeriod. \n' +
                                                 'This error will continue until next month or the limit is raised.'); }
                            return 6;
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
        var verb = self.config[vehicleIndex].showVerboseConsole;
        
        doGetData();
        
        function doGetData() {
            request.get({
                url: urlData + '/api/1/vehicles/' + self.vehicles[vehicleIndex].vin + '/vehicle_data',
                headers: { 'Authorization': 'Bearer ' + accessToken.access_token, 
                           'Content-type': 'application/json' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    self.lastUpdates[vehicleIndex].data = Date.now();
                    self.lastUpdates[vehicleIndex].isWaking = false;
                    self.sendSocketNotification('UPDATE: [' + vehicleIndex + ']', self.lastUpdates[vehicleIndex]);
                    
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
                        if (JSON.parse(body).error.includes('timeout')) {
                            if (verb) { console.log('MMM-Tesla3: timed out during data retrieval for [' + vehicleIndex + ']; trying again in 15 minute.'); }
                            setTimeout(() => self.getData(vehicleIndex), 15 * 60000);
                            return 3;
                        }
                        if (JSON.parse(body).error.includes('vehicle unavailable')) {
                            if (verb) { console.log('MMM-Tesla3: vehicle [' + vehicleIndex + '] unavailalbe; may be vehicle network strength or connectivity issue.'); }
                            return 4;
                        }
                        if (JSON.parse(body).error.includes('account disabled: EXCEEDED_LIMIT')) {
                            if (verb) { console.log('MMM-Tesla3: error during data retrieval for [' + vehicleIndex + '] account disabled: EXCEEDED_LIMIT. \n' +
                                                     'Consider raising limit or reducing wakePeriod. \n' +
                                                     'This error will continue until next month or the limit is raised.'); }
                             return 6;
                        }
                    }
                    
                    console.log('MMM-Tesla3: unhandled error during vehicle [' + vehicleIndex + '] data retrieval\nbody:'+body+'\nerror:'+error);
                    return 99; //failed to update
                }
            });
        }
    },

    wakeVehicle: function(vehicleIndex, callback) {
        var self = this;
        var verb = self.config[vehicleIndex].showVerboseConsole;
        
        doWakeVehicle();
        
        //wake and return to process after 2 minutes
        function doWakeVehicle () {
            request.post({
                url: urlData + '/api/1/vehicles/' + self.vehicles[vehicleIndex].vin + '/wake_up',
                headers: { 'Authorization': 'Bearer ' + accessToken.access_token, 
                           'Content-type': 'application/json' }
            }, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    // send back waking response which contains some interim info
                    if (verb) { self.sendSocketNotification('WAKING: [' + vehicleIndex + ']', JSON.parse(body).response); }
                    
                    if (callback && typeof callback === 'function') { callback(); }
                } else {
                    if (body) {
                        if (JSON.parse(body).error.includes('account disabled: EXCEEDED_LIMIT')) {
                            if (verb) { console.log('MMM-Tesla3: error during wake for [' + vehicleIndex + '] account disabled: EXCEEDED_LIMIT. \n' +
                                                     'Consider raising limit or reducing wakePeriod. \n' +
                                                     'This error will continue until next month or the limit is raised.'); }
                             return 6;
                        }
                    }
                    
                    console.log('MMM-Tesla3: unhandled error during vehicle [' + vehicleIndex + '] wake\nbody:'+body+'\nerror:'+error);
                    return 99; //failed to update
                }
            });
        }
    },
    
    refreshToken: function(callback) {
        var self = this;
        
        if (!callback) { console.log('MMM-Tesla3: updating access token based on 6 hour threshold.'); }

        // original token.json need only contain [{refresh_token: "token characters"}]
        accessToken = JSON.parse(fs.readFileSync(self.path + '/token.json'));
        // at this point, accessToken.refresh_token is the only parameter of interest
        
        const credentials = {
            grant_type: 'refresh_token',
            refresh_token: accessToken.refresh_token,
            client_id: clientId
        };
        
        request.post({
                url: urlAuth + '/oauth2/v3/token',
                headers: { 'Content-type': 'application/json' },
                body: JSON.stringify(credentials)
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // WARNING: 
                // this writes to the disk at least every 6 hours before the accessToken.access_token goes stale
                // token.json "refresh_token" will not work forever, so this write keeps refresh_token updated with access_token
                self.nextTokenUpdate = Date.now() + 6 * 60 * 60000;
                fs.writeFileSync(self.path + '/token.json', body);
                accessToken = JSON.parse(body);
                
                if (callback && typeof callback === 'function') { callback(); }
            } else {
                if (response) {
                    if (response.statusCode == 400) {
                        console.log('MMM-Tesla3: Bad request error during access_token request. Potential causes here:\n' + 
                                                 'https://developer.tesla.com/docs/fleet-api/getting-started/conventions.\n' +
                                                 'Maybe bad client id in config file.');
                        return 1;
                    }
                    
                    if (response.statusCode == 401) {
                        console.log('MMM-Tesla3: the refresh token has become invalid; need to refresh however you got it and re-paste into token.json.' +
                                                 '\nerror:'+body);
                        self.sendSocketNotification('ERROR: refresh token stale',body);
                        return 2;
                    }
                }
                if (error) {
                    if (error.toString().includes('ENOTFOUND') || error.toString().includes('ETIMEDOUT') || error.toString().includes('ESOCKETTIMEDOUT')) {
                        console.log('MMM-Tesla3: timed out connecting to tesla.com. Check internet connection. \nerror:'+error);
                        return 3;
                    }
                }
                
                console.log('MMM-Tesla3: Unhandled error during access_token update. Uncaught status codes can be found here:' +
                                        'https://developer.tesla.com/docs/fleet-api/getting-started/conventions.' + 
                                        '\nbody:'+body+'\nerror:'+error);
                return 99;
            }
        });
    }
});
