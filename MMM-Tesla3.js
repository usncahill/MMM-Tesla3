Module.register("MMM-Tesla3", {

/* Magic Mirror
 * Module: MMM-Tesla3
 *
 * By usncahill with front-end from denverquane/MMM-Teslamate
 * MIT Licensed.
 */

    getScripts: function () {
        return [
            this.data.path + 'scripts/load-file.js'
        ];
    },
    getStyles: function () {
        return [
            'MMM-Tesla3.css',
        ];
    },

    // Default module config
    defaults: {
        vehicleIndex: 0,                //required for multi-car or not first car
        vehicleName: null,
        showVehicleName: true,
        rangeDisplayType: "distance",   //percent or distance
        useHomeLink: true,              // determine if home by proximity to homelink device
        homeLatitude: null,             // at least 4 decimals ##.####; gmaps
        homeLongitude: null,            // at least 4 decimals ##.####; gmaps
        showLastUpdateTime: true,       // show time of last update
        showBatteryBar: true,
        showBatteryBarIcon: true,
        showBatteryBarTime: true,
        showBatteryReserve: true,       // shows when battery cold
        showBatteryLevelColors: true,
        percentBatteryLevelLow: 15,
        percentBatteryLevelCritical: 5,
        saturateModule: 1,
        saturateCarImage: 1,
        saturateIcons: 1,
        saturateBatteryBar: 1,
        showStatusIcons: true,
        showWarningIcons: true,
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
        showConnectedIcon: true,
        // showTemperature NOT INCLUDED IN "Initial Changes"
        refreshPeriod: 30,  // minutes; check whether awake and get data; otherwise wake for the wakePeriod time
        wakePeriod: 960,     // minutes; when refreshing data, allow waking at this interval
        wakeIntervals: [],  // optional: empty just means use wakePeriod
        clientId: null,
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
        showDebug: false,
        showVerboseConsole: true,
        showTable: false,
        showTableOdometer: true,
        showEasterEggs: false,
    },

    start: function () {
		Log.info('Starting module: ' + this.name);
		this.sendSocketNotification('START', this.config);
        this.vehicle = null;
        this.vehicleData = null;
        this.lastUpdates = null;
    },

 	socketNotificationReceived: function(notification, payload) {
		if (notification === 'VEHICLE: [' + this.config.vehicleIndex + ']') {
            this.vehicle = payload;
            this.vehicleData.state = this.vehicle.state; //update state
			this.updateDom();
        } else if (notification === 'UPDATE: [' + this.config.vehicleIndex + ']') {
            this.lastUpdates = payload;
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

        // update the main visual: car, battery, icons
        this.generateGraphicDom(wrapper, this.vehicleData);

        // update table (optional): NOT INCLUDED YET ...
/*         if (this.config.showTable)
            this.generateTableDom(wrapper, data); */

        return wrapper;
    },

    generateGraphicDom: function (wrapper, data) {
        var stateIcons = [];
        var warningIcons = [];
        const path = this.data.path;
        
        // initialize in case data is empty
        var state = (this.vehicle ? this.vehicle.state : "offline");
        var vehicleName = this.config.vehicleName || (this.vehicle ? this.vehicle.display_name : "");
        var batteryOverlayText = (this.lastUpdates)
                                    ? (this.lastUpdates.isWaking)
                                        ? "Waking" 
                                        : "Loading"
                                    : "Loading";
        var [batteryBigNumber,batteryUnit,batteryLevelClass,batteryOverlayIcon] = ["","","",""];
        var [batteryUsable,batteryReserve,batteryReserveVisible,chargeLimitSOC] = [0,0,false,0];
        
        // allow generating the dom without any data instead of boring "Loading..."
        if (data) {
            // testing whether setting state here is necessary
            // every data update will be preceded by a vehicle update, so vehicle.state will be fresh. 
            // since vehicle.state is set above, dont overwrite again, in case this gGD run is prompted by a vehicle list update and not a data update. the data state could be stale
            //state = data.state;
            
            if (this.config.homeLatitude && this.config.homeLongitude) {
                this.isHome = (Math.sqrt((this.vehicleData.drive_state.latitude - this.config.homeLatitude)**2 + (this.vehicleData.drive_state.longitude - this.config.homeLongitude)**2) / 360 * this.config.earthRadius * 2 * Math.PI < this.config.homeRadius);
            }
            
            // ye olde Teslas dont send their shift_state apparently, ugh
            // force shift_state based on user presence
            (data.drive_state.shift_state === null)
                ? (data.vehicle_state.is_user_present)
                    ? data.drive_state.shift_state = "D"
                    : data.drive_state.shift_state = "P"
                : null;
            
            // save states for top left icons
            (data.state === "asleep" || data.state === "suspended")
                ? stateIcons.push("sleep")
                : ((data.drive_state.shift_state !== "P" && this.config.showDrivingIcon)
                    ? stateIcons.push("steering-wheel")
                    : null);
            
            ((this.config.useHomeLink && data.vehicle_state.homelink_nearby || this.isHome) && this.config.showHomeIcon)
                ? stateIcons.push("car-garage") : null;
            
            (data.charge_state.charging_state !== "Disconnected")
                ? ((this.config.showPluggedIcon) 
                    ? stateIcons.push("plug") 
                    : null )
                : ((data.drive_state.shift_state === "P" && this.config.showUnPluggedIcon)
                    ? warningIcons.push("plug-x")
                    : null);
            
            (data.charge_state.charging_state !== "Charging" && (data.charge_state.scheduled_charging_pending || data.charge_state.managed_charging_active) && this.config.showScheduledChargeIcon)
                ? stateIcons.push("clock-bolt") : null;
            
            (data.charge_state.off_peak_charging_enabled && this.config.showOffPeakIcon)
                ? stateIcons.push("clock-dollar") : null;
            
            (data.vehicle_state.sentry_mode && this.config.showSentryModeIcon)
                ? stateIcons.push("device-computer-camera") : null;
            
            (data.state === "updating")
                ? stateIcons.push("cloud-download")
                : (data.vehicle_state.software_update.status !== "")
                    ? stateIcons.push("cloud-plus")
                    : null;
            
            (data.state === "offline")
                ? warningIcons.push("wifi-off")
                : (this.config.showConnectedIcon)
                    ? stateIcons.push("wifi")
                    : null;
            
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
            
            (data.climate_state.is_climate_on && this.config.showAirConditioningIcon)
                ? warningIcons.push("air-conditioning") : null;
            
            (data.vehicle_state.santa_mode && this.config.showEasterEggs)
                ? warningIcons.push("santa")
                : null;
            
            batteryUsable = data.charge_state.usable_battery_level;
            batteryReserve = (data.charge_state.battery_level - data.charge_state.usable_battery_level);
            batteryReserveVisible = (batteryReserve) > 1; // at <= 1% reserve the app and the car don't show it, so we won't either
            chargeLimitSOC = data.charge_state.charge_limit_soc;
            batteryOverlayIcon = (!this.config.showBatteryBarIcon) 
                ? `` 
                : (data.charge_state.charging_state === "Charging")
                    ? `<span class="batteryicon icon-bolt"><load-file replaceWith src="${path}/icons/bolt.svg"></load-file></span>`
                    : (data.charge_state.scheduled_charging_pending && this.config.showScheduledChargeIcon)
                        ? (data.charge_state.scheduled_charging_mode === "StartAt")
                            ? `<span class="batteryicon icon-clock-startat"><load-file replaceWith src="${path}/icons/clock-startat.svg"></load-file></span>`
                            : `<span class="batteryicon icon-clock-departby"><load-file replaceWith src="${path}/icons/clock-departby.svg"></load-file></span>`
                        : (batteryReserveVisible && showBatteryReserveIcon)
                            ? `<span class="batteryicon icon-snowflake"><load-file replaceWith src="${path}/icons/snowflake.svg"></load-file></span>`
                            : ``;
            batteryOverlayText = (data.charge_state.scheduled_charging_pending && this.config.showBatteryBarTime) 
                ? (data.charge_state.scheduled_charging_mode === "StartAt")
                    ? ((data.charge_state.scheduled_charging_start_time_minutes || data.charge_state.scheduled_charging_start_time_app) / 0.6).toString().padStart(4,"0")
                    : (data.charge_state.scheduled_departure_time_minutes / 0.6).toString().padStart(4,"0")
                : ``;
            
            vehicleName = this.config.vehicleName || data.vehicle_state.vehicle_name;
            batteryBigNumber = this.config.rangeDisplayType === "percent" 
                ? data.charge_state.usable_battery_level.toFixed(0) 
                : data.charge_state.battery_range.toFixed(0);
            batteryUnit = this.config.rangeDisplayType === "percent" 
                ? "%" 
                : (data.gui_settings.gui_distance_units === "mi/hr" 
                    ? "mi" 
                    : "km");
            batteryLevelClass = (data.charge_state.usable_battery_level > this.config.percentBatteryLevelLow || !this.config.showBatteryLevelColors)
                ? "battery-level-normal"
                : (data.charge_state.usable_battery_level > this.config.percentBatteryLevelCritical)
                    ? "battery-level-low"
                    : "battery-level-critical";
        } else {
            stateIcons.push("sleep");
            warningIcons.push("wifi-off");
        }
        
        // size options
        // size of the icons + battery (above text)
        const layWidth = this.config.sizeOptions.width || 450;   // px, default: 450
        const layHeight = this.config.sizeOptions.height || 203; // px, default: 203
        // the battery images
        const layBatWidth = this.config.sizeOptions.batteryWidth || 250;  // px, default: 250
        const layBatHeight = this.config.sizeOptions.batteryHeight || 75; // px, default: 75
        const layBatTopMargin = 0; // px, default: 0
        // top offset - to reduce visual distance to the module above
        const topOffset = this.config.sizeOptions.topOffset || 0; // px, default: -40

        // calculate scales
        var layBatScaleWidth = layBatWidth / 250;  // scale factor normalized to 250
        var layBatScaleHeight = layBatHeight / 75; // scale factor normalized to 75
        var layScaleWidth = layWidth / 450;        // scale factor normalized to 203
        var layScaleHeight = layHeight / 203;      // scale factor normalized to 203

        const teslaModel = this.config.carImageOptions.model.toLowerCase() || "ms";
        const teslaView = this.config.carImageOptions.view || "STUD_3QTR";
        const teslaOptions = this.config.carImageOptions.options || "DV4W,INBFP,MTS08,PPMR,WT19";
        const teslaImageWidth = 720; // Tesla compositor stopped returning arbitrary-sized images, only steps of 250, 400, 720 etc work now. We use CSS to scale the image to the correct layout width
        const teslaImageUrl = `https://static-assets.tesla.com/configurator/compositor?&model=${teslaModel}&view=${teslaView}&size=${teslaImageWidth}&options=${teslaOptions}&bkba_opt=1`;
        const imageOffset = this.config.carImageOptions.verticalOffset || 0;
        const imageOpacity = this.config.carImageOptions.imageOpacity || 0.2;
        
        const showVehicleName = this.config.showVehicleName;
        const saturateModule = this.config.saturateModule;
        const saturateCarImage = this.config.saturateCarImage;
        const saturateIcons = this.config.saturateIcons;
        const saturateBatteryBar = this.config.saturateBatteryBar;
        
        var lastUpdateDateTime = ""
        if (this.lastUpdates && this.config.showLastUpdateTime) {
            const dtLastUpdateData = String((new Date(this.lastUpdates.data)).getMonth() + 1).padStart(2, '0') + '/' +
                                     String((new Date(this.lastUpdates.data)).getDate()).padStart(2, '0') + ' ' +
                                    (new Date(this.lastUpdates.data)).toTimeString().substr(0,5).replace(":","").padStart(4,"0");
            lastUpdateDateTime = `<span class="lastupdatetext small">Updated: ${dtLastUpdateData}</span>`;
        }
        
        // Debugging / Testing
        if (this.config.showDebug) {
            vehicleName = "01234567890123";
            dtLastUpdateData = "2358";
            batteryOverlayIcon = `<span class="batteryicon icon-clock-startat"><load-file replaceWith src="${path}/icons/clock-startat.svg"></load-file></span>`;
            batteryOverlayText = (2359).toString().padStart(4,"0");
            batteryLevelClass = "battery-level-critical";
            batteryUnit = "km"
            batteryBigNumber = 222;
            batteryUsable = 5;
            batteryReserve = 15;
            batteryReserveVisible = true; // at <= 1% reserve the app and the car don't show it, so we won't either
            chargeLimitSOC = 85;
            
            stateIcons = [];
            warningIcons = [];
            var tempIcons = ["sleep","steering-wheel","car-garage","lock","plug","clock-bolt","clock-dollar","device-computer-camera","cloud-download","cloud-plus","wifi"];
            stateIcons.push(...tempIcons);
            
            var tempIcons = ["plug-x","lock-open","window-up","car-door","air-conditioning","tire-exclamation"];
            warningIcons.push(...tempIcons);
        }
        
        const showStatusIcons = this.config.showStatusIcons;
        const showWarningIcons = this.config.showWarningIcons;
        const renderedStateIcons = stateIcons.map((icon) => `<span class="stateicon icon-${icon}"><load-file replaceWith src="${path}/icons/${icon}.svg"></load-file></span>`)
        const renderedWarningIcons = warningIcons.map((icon) => `<span class="warningicon icon-${icon}"><load-file replaceWith src="${path}/icons/${icon}.svg"></load-file></span>`)
        
        let batteryBarHtml = '';
        if (this.config.showBatteryBar) {
            batteryBarHtml = `
                <!-- Battery graphic - outer border -->
                <div style="margin-left: ${(layWidth - layBatWidth) / 2}px;
                            width: ${layBatWidth}px; 
                            height: ${layBatHeight}px;
                            margin-top: ${layBatTopMargin}px;
                            border: 2px solid #aaa;
                            border-radius: ${10 * layBatScaleHeight}px;
                            filter: saturate(${saturateBatteryBar});">

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
                                    border-bottom-left-radius: ${2.5 * layBatScaleHeight}px;"></div>

                        <!-- Reserved charge rectangle -->
                        <div class="battery-level-reserve" style="position: relative; 
                                    top: -${layBatHeight - 8 - 2 - 2}px; 
                                    left: ${Math.round(layBatScaleWidth * 2.38 * batteryUsable)}px; 
                                    z-index: 2;
                                    width: ${Math.round(layBatScaleWidth * 2.38 * (batteryReserve))}px;
                                    visibility: ${batteryReserveVisible ? 'visible' : 'hidden'};
                                    height: ${layBatHeight - 8 - 2 - 2}px;
                                    opacity: 0.8;
                                    border-top-left-radius: 2.5px;
                                    border-bottom-left-radius: 2.5px;"></div>

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
                                    align-items: center;
                                    justify-content: center;">
                            ${batteryOverlayIcon}
                            <span class="batterytext small">${batteryOverlayText}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div style="width: ${layWidth}px; height: ${layHeight}px; filter: saturate(${saturateModule});">
                <div style="z-index: 1; 
                            position: relative; top: 0px; left: 0px; 
                            margin-top: ${topOffset}px;
                            margin-bottom: -${layHeight}px;
                            width: ${layWidth}px; 
                            height: ${layHeight}px; 
                            opacity: ${imageOpacity}; 
                            background-image: url('${teslaImageUrl}'); 
                            background-size: ${layWidth * (teslaModel == 'mx' ? 1.5 : 1)}px;
                            background-position: -${layWidth * (teslaModel == 'mx' ? 0.25 : 0)}px ${imageOffset}px;
                            filter: saturate(${saturateCarImage});">
                </div>
                            
                <div style="z-index: 2; 
                            position: relative;
                            margin-top: ${topOffset}px;
                            top: 0px; 
                            left: 0px;">
                    <!-- Vehicle Name -->
                    <div style="margin-left: auto; 
                                text-align: center; 
                                width: ${layWidth}px; 
                                height: 20px;
                                visibility: ${showVehicleName ? 'visible' : 'hidden'};" >
                        <span class="bright small light vehicle-name">${vehicleName}</span>
                    </div>

                    <!-- Percentage/range -->
                    <div style="margin-left: ${layWidth / 3}px;
                                text-align: center; 
                                width: ${layWidth / 3}px;
                                height: 70px">
                        <span class="bright large light">${batteryBigNumber}</span><span class="normal medium">${batteryUnit}</span>
                    </div>

                    <!-- State icons -->
                    <div style="float: left;
                                margin-top: -${60 + 30 * layScaleWidth}px;
                                margin-left: ${10 * layScaleWidth}px;
                                width: ${(layWidth / 3) - 20 * layScaleWidth}px;
                                text-align: right;
                                display: flex;
                                flex-wrap: wrap;
                                flex-direction: row;
                                justify-content: flex-start;
                                filter: saturate(${saturateIcons}); 
                                ${state == "offline" ? 'opacity: 0.3;' : ''};
                                ${!showStatusIcons ? "visibility: hidden" : ""};" 
                             class="small">
                        ${renderedStateIcons.join(" ")}
                    </div>

                    <!-- Warning icons -->
                    <div style="float: right;
                                margin-top: -${60 + 30 * layScaleWidth}px;
                                margin-right: ${10 * layScaleWidth}px;
                                width: ${(layWidth / 3) - 20 * layScaleWidth}px;
                                text-align: left;
                                display: flex;
                                flex-wrap: wrap;
                                flex-direction: row;
                                justify-content: flex-end;
                                filter: saturate(${saturateIcons});
                                ${!showWarningIcons ? "visibility: hidden" : ""};" 
                             class="small">
                        ${renderedWarningIcons.join(" ")}
                    </div>

                    ${batteryBarHtml}
                    
                    <!-- Last Update Time -->
                    <div class="small"
                         style="z-index: 6;
                                margin-right: ${30 * layScaleWidth}px;
                                position: relative; 
                                top: 0px; 
                                left: 0; 
                                height: 16px;
                                text-align: right;
                                display: flex;
                                align-items: right;
                                justify-content: right;">
                        ${lastUpdateDateTime}
                    </div>
                </div>
            </div>
		`;
    },
    
    // NOT PART OF MMM-Tesla3 yet!
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