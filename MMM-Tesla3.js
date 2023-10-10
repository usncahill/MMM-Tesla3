/* global Module */

/* Magic Mirror
 * Module: MMM-Tesla2
 *
 * By Jan Henrik Gundelsby and Martin Burheim Tingstad
 * MIT Licensed.
 */

Module.register("MMM-Tesla2",{

	defaults: {
		refreshInterval: 1000 * 60 * 5, // refresh every 5 minutes
		updateInterval: 1000 * 60 * 5, // update every 5 minutes
		timeFormat: config.timeFormat,
		lang: config.language,

		initialLoadDelay: 0, // 0 seconds delay
		retryDelay: 2500
	},
	
	// Define required scripts.
	getScripts: function() {
		return [];
	},
	
	getStyles: function() {
		return [];
	},

	start: function() {
		Log.info('Starting module: ' + this.name);
		this.loaded = false;
		this.sendSocketNotification('CONFIG', this.config);
	},

	getDom: function() {
		var batteryWidth = 300;
		var batteryHeight = batteryWidth/4;
		console.log('getDom() - ' + this.battery_level );
		var wrapper = document.createElement("div");

		if (!this.loaded) {
			wrapper.innerHTML = this.translate('LOADING');
			return wrapper;
		}		
		
		if (!this.battery_level) {
			wrapper.innerHTML = "No data";
			return wrapper;
		}

		var textElement = document.createElement("div");
		if(this.charging_state == "Charging") {
			var prettyPrintedState = this.charging_state + ' ('
			+ Math.floor(this.charge_minutes_remaining/60) + 'h '
			+ Math.floor(this.charge_minutes_remaining%60) + 'm)';
		}
		else {
			var prettyPrintedState = this.charging_state;
		}
		textElement.innerHTML = '<b>' + this.vehicle_name + '</b><br/>' +
		prettyPrintedState + ' - ' + Math.floor(this.range) + ' km';

		wrapper.appendChild(textElement);

		var svgNS = "http://www.w3.org/2000/svg";
		var svg = document.createElementNS(svgNS, "svg");
		svg.setAttribute('width', batteryWidth);
		svg.setAttribute('height', batteryHeight);

		var batteryFrame = document.createElementNS(svgNS, "rect");

		batteryFrame.setAttribute('width', batteryWidth);
	    batteryFrame.setAttribute('height', batteryHeight);
		batteryFrame.setAttribute('style', "fill:rgba(0,0,0,0);stroke-width:2;stroke:rgba(255,255,255, 0.75)");
		batteryFrame.setAttribute("rx", batteryWidth/80);
		batteryFrame.setAttribute("ry", batteryWidth/80);
		svg.appendChild(batteryFrame);

		var shiftedContentContainer = document.createElementNS(svgNS, "svg");
		shiftedContentContainer.setAttribute("x", batteryWidth/80);
		shiftedContentContainer.setAttribute("y", batteryWidth/80);

		var batteryContent = document.createElementNS(svgNS, "rect");

	    batteryContent.setAttribute('width', this.battery_level/100*batteryWidth);
	    batteryContent.setAttribute('height', batteryHeight*0.9);
		batteryContent.setAttribute('style', "fill:rgba(45,220,45,0.7)");
		batteryContent.setAttribute("rx", batteryWidth/200);
		batteryContent.setAttribute("ry", batteryHeight/50);
		shiftedContentContainer.appendChild(batteryContent);

		var chargeLevelText = document.createElementNS(svgNS, "text");
		chargeLevelText.setAttribute("x", 25/200*batteryWidth);
		chargeLevelText.setAttribute("y", 36/50*batteryHeight);
		chargeLevelText.setAttribute("style", "fill:rgba(255,255,255,0.4); font: bold " + 20*batteryWidth/200 + "px sans-serif;");

		var textNode = document.createTextNode(this.battery_level + '%');
		chargeLevelText.appendChild(textNode);
		shiftedContentContainer.appendChild(chargeLevelText);

		var batteryBar = document.createElementNS(svgNS, "path");
		batteryBar.setAttribute("stroke", "#ffffff");
		batteryBar.setAttribute("d", "M" + batteryWidth*50/100 + " 0 L" + batteryWidth*50/100 + " " + +batteryHeight + +2);
		batteryBar.setAttribute('stroke-width', "2");
		batteryBar.setAttribute('opacity', "0.25");
		shiftedContentContainer.appendChild(batteryBar);

		var batteryBar = document.createElementNS(svgNS, "path");
		batteryBar.setAttribute("stroke", "#ffffff");
		batteryBar.setAttribute("d", "M" + batteryWidth*60/100 + " 0 L" + batteryWidth*60/100 + " " + +batteryHeight + +2);
		batteryBar.setAttribute('stroke-width', "2");
		batteryBar.setAttribute('opacity', "0.25");
		shiftedContentContainer.appendChild(batteryBar);

		var batteryBar = document.createElementNS(svgNS, "path");
		batteryBar.setAttribute("stroke", "#ffffff");
		batteryBar.setAttribute("d", "M" + batteryWidth*70/100 + " 0 L" + batteryWidth*70/100 + " " + +batteryHeight + +2);
		batteryBar.setAttribute('stroke-width', "2");
		batteryBar.setAttribute('opacity', "0.25");
		shiftedContentContainer.appendChild(batteryBar);

		var batteryBar = document.createElementNS(svgNS, "path");
		batteryBar.setAttribute("stroke", "#ffffff");
		batteryBar.setAttribute("d", "M" + batteryWidth*80/100 + " 0 L" + batteryWidth*80/100 + " " + +batteryHeight + +2);
		batteryBar.setAttribute('stroke-width', "2");
		batteryBar.setAttribute('opacity', "0.25");
		shiftedContentContainer.appendChild(batteryBar);

		var batteryBar = document.createElementNS(svgNS, "path");
		batteryBar.setAttribute("stroke", "#ffffff");
		batteryBar.setAttribute("d", "M" + batteryWidth*90/100 + " 0 L" + batteryWidth*90/100 + " " + +batteryHeight + +2);
		batteryBar.setAttribute('stroke-width', "2");
		batteryBar.setAttribute('opacity', "0.25");
		shiftedContentContainer.appendChild(batteryBar);

		svg.appendChild(shiftedContentContainer);
		wrapper.appendChild(svg);

		return wrapper;
	},

	processChargeData: function(data) {
		console.log('processChargeData');
		console.log(data);
		if (!data.battery_level) {
			return;
		}
		
		this.battery_level = data.usable_battery_level;
		this.charging_state = data.charging_state;
		this.range = data.ideal_battery_range*1.609344;
		this.charge_minutes_remaining = data.time_to_full_charge * 60;

		generateSVG(this.battery_level);
	
		return;
	},

	processDrivestateData: function(data) {
		console.log('processDrivestateData');
		console.log(data);
		if (!data.latitude) {
			return;
		}
		this.shift_state = data.shift_state;
		this.latitude = data.latitude;
		this.longitude = data.longitude;
	
		return;
	},

	processVehicleData: function(data) {
		if(!data.display_name) {
			return;
		}
		this.vehicle_name = data.display_name;
		return;
	},

 	socketNotificationReceived: function(notification, payload) {
		 console.log("socketNotificationReceived");
		if (notification === "STARTED") {
			this.updateDom();
		}
		else if (notification === "CHARGE_DATA") {
			this.loaded = true;
			this.processChargeData(JSON.parse(payload).response);
			this.updateDom();
		}
		else if (notification === "DRIVESTATE_DATA") {
			this.loaded = true;
			this.processDrivestateData(JSON.parse(payload).response);
			this.updateDom();
		}
		else if (notification === "VEHICLE_DATA") {
			this.loaded = true;
			this.processVehicleData(JSON.parse(payload).response);
			this.updateDom();
		}
	},
});
