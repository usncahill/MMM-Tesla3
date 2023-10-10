Module.register("MMM-Tesla3", {

/* Magic Mirror
 * Module: MMM-Tesla3
 *
 * By usncahill with front-end from denverquane/MMM-Teslamate
 * MIT Licensed.
 */

    getScripts: function () {
        return [
            'scripts/load-file.js'
        ];
    },
    getStyles: function () {
        return [
            'MMM-Tesla3.css',
        ];
    },

    // Default module config
    defaults: {
        rangeDisplayLarge: "distance", //percent or distance
        vehicleIndex: 0,
        showVehicleName: true,
        useHomeLink: true, // easy way of figuring out homeness
        homeLatitude: null, // at least 4 decimals ##.####; gmaps
        homeLongitude: null, // at least 4 decimals ##.####; gmaps
        showBatteryReserve: true, // shows when battery cold
        showBatteryBar: true,
        showBatteryLevelColors: true,
        percentBatteryLevelLow: 15,
        percentBatteryLevelCritical: 5,
        showLockedIcon: false,
        showUnLockedIcon: true,
        showPluggedIcon: true,
        showUnPluggedIcon: true,
        showHomeIcon: true,
        showDrivingIcon: true,
        showSentryModeIcon: true,
        showAirConditioningIcon: true,
        showOffPeakIcon: true,
        showScheduledChargeIcon: true,
        showBatteryReserveIcon: false,
        // showTemperature NOT INCLUDED IN "Initial Changes"
        refreshInterval: 15, //minutes
        refreshIntervalCharging: 5, //minutes
        sizeOptions: {
            width: 400,
            height: 203,
            batteryWidth: 250,
            batteryHeight: 75,
            topOffset: 40,
        },
        carImageOptions: {
            model: "MS", // MS MX MY M3
            view: "STUD_3QTR", //STUD_3QTR,STUD_SEAT,STUD_SIDE,STUD_REAR,STUD_WHEEL
            options: "DV4W,INBFP,MTS08,PPMR,WT19", // https://tesla-api.timdorr.com/vehicle/optioncodes
            verticalOffset: 0,
            imageOpacity: 0.2, // 0 - 1
        },
        homeRadius: 100, // meter
        earthRadius: 6371000, // meter; avg
        showVerboseConsole: true,
        showDebug: false,
        showTable: false,
        showTableOdometer: true,
    },

    start: function () {
		Log.info('Starting module: ' + this.name);
		this.sendSocketNotification('VEHICLE', this.config);
        this.vehicle = null;
        this.vehicleData = null;
    },

 	socketNotificationReceived: function(notification, payload) {
		if (notification === "READY") {
            this.sendSocketNotification('DATA', this.config);
		} else if (notification === 'VEHICLE: [' + this.config.vehicleIndex + ']') {
            this.vehicle = payload;
			this.updateDom();
        } else if (notification === 'WAKING: [' + this.config.vehicleIndex + ']') {
            // do nothing, for now
            // the WAKE response is not enough to populate fields
            // VEHICLE would need to populate a this.vehicleName or something
            return;
		} else if (notification === 'DATA: [' + this.config.vehicleIndex + ']') {
            this.vehicleData = payload;
			this.updateDom();
		}
	},
    
    getDom: function () {
        const wrapper = document.createElement('div');

		if (!this.vehicle) {
			wrapper.innerHTML = 'Loading';
			return wrapper;
		} else {
            if (this.vehicle.state === 'asleep' || this.vehicle.state === 'offline') {
                if (this.vehicle.display_name) {
                    wrapper.innerHTML = "Waking " + this.vehicle.display_name;
                    return wrapper;
                }
            } else if (this.vehicle.display_name && !this.vehicleData) {
                wrapper.innerHTML = "Loading " + this.vehicle.display_name;
                return wrapper;
            }
        }
		if (!this.vehicleData) {
			wrapper.innerHTML = "No data";
			return wrapper;
		}

        if (this.config.homeLatitude && this.config.homeLongitude) {
            this.isHome = (Math.sqrt((this.vehicleData.drive_state.latitude - this.config.homeLatitude)**2 + (this.vehicleData.drive_state.longitude - this.config.homeLongitude)**2) / 360 * this.config.earthRadius * 2 * Math.PI < this.config.homeRadius);
        }

        // update the main visual: car, battery, icons
        this.generateGraphicDom(wrapper, this.vehicleData);

        // update table (optional): NOT INCLUDED IN "Initial Changes"
/*         if (this.config.showTable)
            this.generateTableDom(wrapper, data); */

        return wrapper;
    },

    generateGraphicDom: function (wrapper, data) {
        const stateIcons = [];
        const warningIcons = [];
        const state = data.state;
        
        // save states for top left icons
        (data.state === "asleep" || data.state === "suspended") 
            ? stateIcons.push("sleep") 
            : ((data.state === "driving" && this.config.showDrivingIcon) 
                ? stateIcons.push("steering-wheel") 
                : null);
        
        ((this.config.useHomeLink && data.vehicle_state.homelink_nearby || this.isHome) && this.config.showHomeIcon)
            ? stateIcons.push("car-garage") : null;
        
        (data.charge_state.charge_port_latch === "Engaged") 
            ? ((this.config.showPluggedIcon) 
                ? stateIcons.push("plug") 
                : null )
            : ((data.state !== "driving" && this.config.showUnPluggedIcon) 
                ? warningIcons.push("plug-x")
                : null);
        
        (data.charge_state.charging_state !== "charging" && (data.charge_state.scheduled_charging_pending || data.charge_state.managed_charging_active) && this.config.showScheduledChargeIcon) 
            ? stateIcons.push("clock-bolt") : null;
        
        (data.charge_state.off_peak_charging_enabled && this.config.showOffPeakIcon) 
            ? stateIcons.push("clock-dollar") : null;
        
        (data.vehicle_state.sentry_mode && this.config.showSentryModeIcon) 
            ? stateIcons.push("device-computer-camera") : null;
        
        (data.climate_state.is_climate_on && this.config.showAirConditioningIcon) 
            ? stateIcons.push("air-conditioning") : null;
        
        (data.state === "updating") 
            ? stateIcons.push("cloud-download") 
            : (data.vehicle_state.software_update.status !== "") 
                ? stateIcons.push("cloud-plus") 
                : null;
        
        (data.state === "offline") ? warningIcons.push("wifi-off") : stateIcons.push("wifi");
        
        // save warning related states for top right icons
        (data.vehicle_state.locked) 
            ? (this.config.showLockedIcon 
                ? stateIcons.push("lock") 
                : null) 
            : (this.config.showUnLockedIcon) 
                ? warningIcons.push("lock-open") 
                : null;
        
        (data.vehicle_state.fd_window + data.vehicle_state.fp_window + data.vehicle_state.rd_window + data.vehicle_state.rp_window > 0) 
            ? warningIcons.push("window-up") 
            : null;
        
        (data.vehicle_state.fd + data.vehicle_state.fp + data.vehicle_state.rd + data.vehicle_state.rp + data.vehicle_state.ft + data.vehicle_state.rt > 0) 
            ? warningIcons.push("car-door") 
            : null;
        
        (data.vehicle_state.tpms_soft_warning_fl || data.vehicle_state.tpms_soft_warning_fr || data.vehicle_state.tpms_soft_warning_rl || data.vehicle_state.tpms_soft_warning_rr) 
            ? warningIcons.push("tire-exclamation") 
            : null;

        if (this.config.showDebug) {
            var tempArr = ["lock","lock","lock","lock","lock","lock","lock","lock","lock","lock","lock","lock","lock"];stateIcons.push(...tempArr);
            warningIcons.push(...tempArr);
        }
        
        // size options
        // size of the icons + battery (above text)
        const layWidth = this.config.sizeOptions.width || 450; // px, default: 450
        const layHeight = this.config.sizeOptions.height || 203; // px, default: 203
        // the battery images
        const layBatWidth = this.config.sizeOptions.batteryWidth || 250; // px, default: 250
        const layBatHeight = this.config.sizeOptions.batteryHeight || 75; // px, default: 75
        const layBatTopMargin = 0; // px, default: 0
        // top offset - to reduce visual distance to the module above
        const topOffset = this.config.sizeOptions.topOffset || 0; // px, default: -40

        // calculate scales
        var layBatScaleWidth = layBatWidth / 250;  // scale factor normalized to 250
        var layBatScaleHeight = layBatHeight / 75; // scale factor normalized to 75
        var layScaleHeight = layHeight / 203;      // scale factor normalized to 203

        const teslaModel = this.config.carImageOptions.model.toLowerCase() || "ms";
        const teslaView = this.config.carImageOptions.view || "STUD_3QTR";
        const teslaOptions = this.config.carImageOptions.options || "DV4W,INBFP,MTS08,PPMR,WT19";
        const teslaImageWidth = 720; // Tesla compositor stopped returning arbitrary-sized images, only steps of 250, 400, 720 etc work now. We use CSS to scale the image to the correct layout width
        const teslaImageUrl = `https://static-assets.tesla.com/configurator/compositor?&model=${teslaModel}&view=${teslaView}&size=${teslaImageWidth}&options=${teslaOptions}&bkba_opt=1`;
        const imageOffset = this.config.carImageOptions.verticalOffset || 0;
        const imageOpacity = this.config.carImageOptions.imageOpacity || 0.2;
        const path = this.data.path;
        const renderedStateIcons = stateIcons.map((icon) => `<span class="stateicon icon-${icon}"><load-file replaceWith src="${path}/icons/${icon}.svg"></load-file></span>`)
        const renderedWarningIcons = warningIcons.map((icon) => `<span class="warningicon icon-${icon}"><load-file replaceWith src="${path}/icons/${icon}.svg"></load-file></span>`)
        
        const batteryUsable = data.charge_state.usable_battery_level;
        const batteryReserve = (data.charge_state.battery_level - data.charge_state.usable_battery_level);
        const batteryReserveVisible = (batteryReserve) > 1; // at <= 1% reserve the app and the car don't show it, so we won't either
        const chargeLimitSOC = data.charge_state.charge_limit_soc;

        var batteryOverlayIcon = (data.charge_state.charging_state === "charging")
            ? `<span class="batteryicon icon-bolt"><load-file replaceWith src="${path}/icons/bolt.svg"></load-file></span>`
            : (batteryReserveVisible && showBatteryReserveIcon)
                ? `<span class="batteryicon icon-snowflake"><load-file replaceWith  src="${path}/icons/snowflake.svg"></load-file></span>` 
                : ((data.charge_state.scheduled_charging_pending || data.charge_state.managed_charging_active) && this.config.showScheduledChargeIcon) 
                    ? `<span class="batteryicon icon-clock-bolt"><load-file replaceWith  src="${path}/icons/clock-bolt.svg"></load-file></span>` 
                    : ``;

        if (this.config.showDebug) {
            batteryOverlayIcon = `<span class="batteryicon icon-clock-bolt"><load-file replaceWith  src="${path}/icons/clock-bolt.svg"></load-file></span>`;
        }

        const vehicleName = data.vehicle_state.vehicle_name;
        const showVehicleName = this.config.showVehicleName;
        const batteryBigNumber = this.config.rangeDisplayLarge === "percent" 
            ? data.charge_state.usable_battery_level.toFixed(0) 
            : data.charge_state.battery_range.toFixed(0);
        const batteryUnit = this.config.rangeDisplay === "percent" 
            ? "%" 
            : (data.gui_settings.gui_distance_units === "mi/hr" 
                ? "mi" 
                : "km");
        const batteryLevelClass = (data.charge_state.usable_battery_level > this.config.percentBatteryLevelLow || !this.config.showBatteryLevelColors)
            ? "battery-level-normal"
            : (data.charge_state.usable_battery_level > this.config.percentBatteryLevelCritical)
                ? "battery-level-low"
                : "battery-level-critical";
        
        let batteryBarHtml = '';
        if (this.config.showBatteryBar) {
            batteryBarHtml = `
                <!-- Battery graphic - outer border -->
                <div style="margin-left: ${(layWidth - layBatWidth) / 2}px;
                            width: ${layBatWidth}px; 
                            height: ${layBatHeight}px;
                            margin-top: ${layBatTopMargin}px;
                            border: 2px solid #aaa;
                            border-radius: ${10 * layBatScaleHeight}px">

                    <!-- Plus pole -->
                    <div style="position: relative; 
                                top: ${(layBatHeight - layBatHeight / 4) / 2 - 1}px;
                                left: ${layBatWidth}px;
                                width: ${8 * layBatScaleWidth}px; height: ${layBatHeight / 4}px;
                                border: 2px solid #aaa;
                                border-top-right-radius: ${5 * layBatScaleHeight}px;
                                border-bottom-right-radius: ${5 * layBatScaleHeight}px;
                                border-left: none;
                                background: #000">
                    </div>

                    <!-- Inner border -->
                    <div style="position: relative; 
                                top: -${23 * layBatScaleHeight}px; 
                                left: 0px;
                                margin-left: 5px;
                                margin-top: ${5 * layBatScaleHeight}px;
                                width: ${(layBatWidth - 12)}px; 
                                height: ${layBatHeight - 8 - 2 - 2}px;
                                border: 1px solid #aaa;
                                border-radius: ${3 * layBatScaleHeight}px;">

                        <!-- Charge rectangle -->
                        <div class="${batteryLevelClass}"
                             style="position: relative; 
                                    top: 0px; 
                                    left: 0px; 
                                    z-index: 2;
                                    width: ${Math.round(layBatScaleWidth * 2.38 * batteryUsable)}px;
                                    height: ${layBatHeight - 8 - 2 - 2}px;
                                    opacity: 0.8;
                                    border-top-left-radius: ${2.5 * layBatScaleHeight}px;
                                    border-bottom-left-radius: ${2.5 * layBatScaleHeight}px;
                                    background-color: #64ff64"></div>

                        <!-- Reserved charge rectangle -->
                        <div style="position: relative; 
                                    top: -${layBatHeight - 8 - 2 - 2}px; 
                                    left: ${Math.round(layBatScaleWidth * 2.38 * batteryUsable)}px; 
                                    z-index: 2;
                                    width: ${Math.round(layBatScaleWidth * 2.38 * (batteryReserve))}px;
                                    visibility: ${batteryReserveVisible ? 'visible' : 'hidden'};
                                    height: ${layBatHeight - 8 - 2 - 2}px;
                                    opacity: 0.8;
                                    border-top-left-radius: 2.5px;
                                    border-bottom-left-radius: 2.5px;
                                    background-color: #6464ff"></div>

                        <!-- Charge limit marker -->
                        <div style="position: relative; 
                                    top: -${(layBatHeight - 8 - 2 - 2) * 2}px; 
                                    left: ${Math.round(layBatScaleWidth * 2.38 * chargeLimitSOC) - 1}px;
                                    height: ${layBatHeight - 8 - 2 - 2}px;
                                    width: 2px;
                                    ${chargeLimitSOC === 0 ? "visibility: hidden" : ""}
                                    border-left: 1px dashed #888"></div>

                        <!-- Battery overlay icon -->
                        <div class="medium"
                             style="z-index: 5;
                                    position: relative; 
                                    top: -${(layBatHeight - 8 - 2 - 2) * 3}px; 
                                    left: 0; 
                                    height: ${(layBatHeight) - 8 - 2 - 2}px;
                                    text-align: center; 
                                    display: flex;
                                    justify-content: center;">
                            ${batteryOverlayIcon}
                        </div>

                    </div>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div style="width: ${layWidth}px; height: ${layHeight}px;">
                <div style="z-index: 1; 
                            position: relative; top: 0px; left: 0px; 
                            margin-top: ${topOffset}px;
                            margin-bottom: -${layHeight}px;
                            width: ${layWidth}px; 
                            height: ${layHeight}px; 
                            opacity: ${imageOpacity}; 
                            background-image: url('${teslaImageUrl}'); 
                            background-size: ${layWidth}px;
                            background-position: 0px ${imageOffset}px;"></div>
                            
                <div style="z-index: 2; 
                            position: relative;
                            margin-top: ${topOffset}px;
                            top: 0px; 
                            left: 0px; ">
                    <!-- Vehicle Name -->
                    <div style="margin-left: auto; 
                                text-align: center; 
                                width: ${layWidth}px; 
                                height: 20px;
                                visibility: ${showVehicleName ? 'visible' : 'hidden'};" >
                        <span class="bright small light vehicle-name">${vehicleName}</span>
                    </div>

                    <!-- Percentage/range -->
                    <div style="margin-left: auto; 
                                text-align: center; 
                                width: ${layWidth}px; 
                                height: 70px">
                        <span class="bright large light">${batteryBigNumber}</span><span class="normal medium">${batteryUnit}</span>
                    </div>

                    <!-- State icons -->
                    <div style="float: left; 
                                margin-top: -${60 + 20 * layScaleHeight}px; 
                                margin-left: ${((layWidth - layBatWidth) / 6)}px;
                                width: ${((layWidth - layBatWidth) / 1.5)}px; 
                                text-align: left; 
                                display: flex;
                                flex-wrap: wrap;
                                flex-direction: row; ${state == "offline" ? 'opacity: 0.3;' : ''}" 
                             class="small">
                        ${renderedStateIcons.join(" ")}
                    </div>

                    <!-- Warning icons -->
                    <div style="float: right; 
                                margin-top: -${60 + 20 * layScaleHeight}px; 
                                margin-right: ${((layWidth - layBatWidth) / 6)}px;
                                width: ${((layWidth - layBatWidth) / 1.5)}px; 
                                text-align: right;
                                display: flex;
                                flex-wrap: wrap;
                                flex-direction: row;" 
                             class="small">
                        ${renderedWarningIcons.join(" ")}
                    </div>

                    ${batteryBarHtml}

                    </div>
                </div>
            </div>
		`;
    },
    
    // NOT PART OF "Initial Changes"
    generateTableDom: function (wrapper, data) {

        const makeSpan = function (className, content) {
            var span = document.createElement("span");
            span.className = className;
            span.innerHTML = content;
            return span;
        }

        const makeChargeRemString = function (remHrs) {
            const hrs = Math.floor(remHrs);
            const mins = Math.ceil((remHrs - hrs) * 60.0);

            return (hrs > 0 ? (hrs + " Hour" + (hrs > 1 ? "s" : "") + ", ") : "") + (mins > 0 ? (mins + " Min" + (mins > 1 ? "s" : "")) : "");
        }

        var attrList = document.createElement("ul");
        attrList.className = "mattributes";

        if (charging) {
            var energyAddedLi = document.createElement("li");
            energyAddedLi.className = "mattribute";
            energyAddedLi.appendChild(makeSpan("icon zmdi zmdi-input-power zmdi-hc-fw", ""));
            energyAddedLi.appendChild(makeSpan("name", "Charge Added"));
            energyAddedLi.appendChild(makeSpan("value", energyAdded + " kWh"));

            var timeToFullLi = document.createElement("li");
            timeToFullLi.className = "mattribute";
            timeToFullLi.appendChild(makeSpan("icon zmdi zmdi-time zmdi-hc-fw", ""));
            timeToFullLi.appendChild(makeSpan("name", "Time to " + chargeLimitSOC + "%"));
            timeToFullLi.appendChild(makeSpan("value", makeChargeRemString(timeToFull)));
            attrList.appendChild(energyAddedLi);
            attrList.appendChild(timeToFullLi);
        } 

        if (this.config.displayOptions.odometer.visible) {
            var odometerLi = document.createElement("li");
            odometerLi.className = "mattribute";
            if (this.config.displayOptions.odometer.fontSize !== null) {
                odometerLi.style = 'font-size: ' + parseFloat(this.config.displayOptions.odometer.fontSize) + 'rem';
            }

            odometerLi.appendChild(makeSpan("icon zmdi zmdi-dot-circle-alt zmdi-hc-fw", ""));
            odometerLi.appendChild(makeSpan("name", "Odometer"));
            odometerLi.appendChild(makeSpan("value", odometer + (!this.config.imperial ? " Km" : " Mi")));

            attrList.appendChild(odometerLi);
        }
        wrapper.appendChild(attrList);
    }
    
});