/* global Module */

/* Magic Mirror
 * Module: MMM-Tesla2
 *
 * By Jan Henrik Gundelsby and Martin Burheim Tingstad
 * MIT Licensed.
 */

Module.register("MMM-Tesla2",{

	defaults: {
		refreshInterval: 1000 * 60 * 60, //refresh every hour
		updateInterval: 1000 * 3600, //update every hour
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
		   textElement.innerHTML = '<b>Tesla</b><br/>' +
		    this.charging_state + ' - ' + Math.floor(this.range) + ' km';

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

 	socketNotificationReceived: function(notification, payload) {
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
	},

// 			<svg width="210pt" height="60pt" viewBox="0 0 210 60" version="1.1" xmlns="http://www.w3.org/2000/svg">
//   <g id="#000000ff" name="background">
//     <path fill="#000000" opacity="1.00" d="M0 0 L220 0 L220 70 L0 70" />
//   </g>

//   <g id="#1f6e43ff" transform="translate(5,5)">
//     <rect width="170" height="50" rx="1" ry="1" style="fill:rgba(63,134,44,0.7);" />
//     <rect width="200" height="50" rx="2" ry="2" style="fill:rgba(0,0,0,0);stroke-width:1.5;stroke:rgba(255,255,255, 0.25)" />

//     <path stroke="#ffffff" stroke-width="1.5" opacity="0.25" d="M100 0 L100 50" />
//     <path stroke="#ffffff" stroke-width="1.5" opacity="0.25" d="M120 0 L120 50" />
//     <path stroke="#ffffff" stroke-width="1.5" opacity="0.25" d="M140 0 L140 50" />
//     <path stroke="#ffffff" stroke-width="1.5" opacity="0.25" d="M160 0 L160 50" />
//     <path stroke="#ffffff" stroke-width="1.5" opacity="0.25" d="M180 0 L180 50" />
//   </g>
// </svg>

});

