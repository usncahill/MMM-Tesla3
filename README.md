# Module: MMM-Tesla3
The `MMM-Tesla3` module is a <a href="https://github.com/MichMich/MagicMirror">MagicMirror</a> addon. This module displays some of your <a href="https://www.tesla.com">Tesla's</a> data on your Mirror. It is forked from <a href="https://github.com/martinburheimtingstad/MMM-Tesla2">MMM-Tesla2</a> and the GUI is a modification of <a href="https://github.com/denverquane/MMM-Teslamate">MMM-TeslaMate</a>. Icons are modifications from [Tabler icon set](https://icon-sets.iconify.design/tabler/). 
This is intended to be a current, state-of-the-API Tesla vehicle module, supporting multiple vehicles, displaying many configurable parameters, while avoiding use a database.


## Installing the module
1. run `git clone https://github.com/usncahill/MMM-Tesla3` from inside your `MagicMirror/modules` folder.
2. obtain a refresh_token. one method: goto [tesla-info.com](https://tesla-info.com/tesla-token.php) and follow the directions there.
3. paste the refresh_token into the refresh_token field of token.json.
4. setup your config.


## Example MMM-Tesla3 in action! ###
![Picture showing 4 configurations of the MMM-Tesla3 magic mirror module.](/images/MMM-Tesla3.png)


## Current Issues Being Worked
* Closing Incremental1 branch: various enhancements
* Opening Incremental2 branch: troubleshoot waking hang, add options to avoid waking (vamp drain), add FE request loop and BE request tracking


## Using the module
To use this module, add it to the modules array in the `config/config.js` file:
````javascript
modules: [
        {
            module: 'MMM-Tesla3',
            position: 'bottom_right',       // Recommend side regions like top_left for best results
            config: {
                // See 'Configuration options' for more information.
                vehicleIndex: 0,            // default 0, index references the n+1th car returned when talking to Tesla
                showVehicleName: true, 
                refreshIntervalCharging: 5  // 15 minutes
                ... many more below
            }
        }
]
````

## Configuration options
The following properties can be configured. Note, don't write the indicated units in your config.

| Option                        | Default/Units | Description
| :-:                           | :-:           | :-
|`vehicleIndex`                 | `0`           | zero-based (0,1,2...) position of the car in your list of cars in Tesla's database.<br>when you get your `refresh_token` from [tesla-info.com](https://tesla-info.com/tesla-token.php), you can see the list there<br>**required for multicar to work**
|`vehicleName`                  | `null`        | enter a value to override the name saved in your car / Tesla.com
|`showVehicleName`              | `true`        | shows vehicle name at top of module
|`rangeDisplayType`             | `distance`    | options: `distance`,`percent`<br>sets the large vehicle range value using the type chosen; range units come from the car's distance GUI settings retrieved from Tesla.com
|`useHomeLink`                  | `true`        | `true` uses the car's proximity to Homelink geomarkers in the Tesla database to determine homeness, which overrides whatever the lat/long calculation determines
|`homeLatitude`                 | `null` deg    | enter latitude as a decimal degrees to at least the 4th decimal place<br>recommend right-clicking google maps to get the coordinates
|`homeLongitude`                | `null` deg    | enter longitude as a decimal degrees to at least the 4th decimal place<br>recommend right-clicking google maps to get the coordinates
|`showBatteryBar`               | `true`        | `true` to show a battery-shaped bar below the charge level / range indicator
|`showBatteryBarIcon`           | `true`        | `true` to show the battery bar icon: bolt=charging, clock-bolt=scheduled charge, snowflake=battery cold
|`showBatteryBarTime`           | `true`        | `true` to show the : bolt=charging, clock >\|=scheduled departby, clock \|>=scheduled startat, snowflake=battery cold
|`showBatteryReserve`           | `true`        | shows the portion of lost battery range/level as blue on battery bar
|`showBatteryLevelColors`       | `true`        | `false` to turn of the battery level coloring in one line
|`percentBatteryLevelLow`       | `15` %        | battery bar color set to yellow below this value; `0` to disable
|`percentBatteryLevelCritical`  | `5` %         | battery bar color set to red below this value; `0` to disable
|`saturateModule`               | `1`           | range: `0 - 2`, set to `0` to remove all color from module (grayscale)
|`saturateCarImage`             | `1`           | range: `0 - 2`, set to `0` to remove all color from your Tesla.com car image (grayscale)
|`saturateIcons`                | `1`           | range: `0 - 2`, set to `0` to remove all color from icons (grayscale), mostly noticable on warnings
|`saturateBatteryBar`           | `1`           | range: `0 - 2`, set to `0` to remove all color from battery bar (grayscale); module will still apply darkness of other color settings, e.g. Battery Level Critical will still be darker than Battery Level Normal
|`showStatusIcons`              | `true`        | `true` enables all vehicle status icons
|`showWarningIcons`             | `true`        | `true` enables all vehicle warning icons
|`showLockedIcon`               | `false`       | `true` shows vehicle lock status as state icon, (lock)
|`showUnLockedIcon`             | `true`        | `true` shows vehicle unlocked status as _warning_ icon, (unlock)
|`showPluggedIcon`              | `true`        | `true` shows vehicle plug status as state icon, (plug)
|`showUnPluggedIcon`            | `true`        | `true` shows vehicle unplug status as _warning_ icon, (plug with x)
|`showHomeIcon`                 | `true`        | `true` shows home status as state icon; this can be triggered by `useHomelink` and being near a homelinked geomarker in Tesla or by MMM-Tesla3 calculating an approximate distance from `homeLatitude` and `homeLongitude`, (car under roof)
|`showDrivingIcon`              | `true`        | `true` shows vehicle status = "drive" as state icon, aka when the car is on the road, (steering wheel)
|`showSentryModeIcon`           | `true`        | `true` shows sentry mode status as state icon, (webcam)
|`showAirConditioningIcon`      | `true`        | `true` shows air conditioning status as state icon, (air conditioner)
|`showOffPeakIcon`              | `true`        | `true` shows off peak charging option status as state icon, (clock with dollar)
|`showScheduledChargeIcon`      | `true`        | `true` shows scheduled charging option status as state icon, (clock with bolt)
|`showConnectedIcon`            | `true`        | `true` shows whether the car is connected to Tesla.com option status as state icon, (wifi)
|`refreshInterval`              | `5` minutes   | e.g. `20` would query the Tesla server every 20 minutes
|`refreshIntervalCharging`      | `15` minutes  | e.g. `20` would query the Tesla server every 20 minutes while charging
|**`sizeOptions`**              | n/a           | must be formatted like a sublist, e.g. <br>`sizeOptions: {`<br>`  width: 400,`<br>`  height: 203,`<br>`  batteryWidth: 250,`<br>`  batteryHeight: 75,`<br>`  topOffset: 40`<br>`},`<br>weird battery or overlapping parts means you likely picked bad numbers
|   `width`                     | `400` pixels  | module width, module scales based on default
|   `height`                    | `203` pixels  | module height, module scales based on default
|   `batteryWidth`              | `250` pixels  | battery bar width, module scales based on default
|   `batteryHeight`             | `75` pixels   | battery bar height, module scales based on default
|   `topOffset`                 | `40` pixels   | module top spacing from module above
|**`carImageOptions`**          | n/a           | must be formatted like a sublist, e.g. <br>`carImageOptions: {`<br>`  model: "MS",`<br>`  view: "STUD_3QTR",`<br>`  options: "WT19",`<br>`  verticalOffset: 0,`<br>`  imageOpacity: 0.2`<br>`},`<br>no picture means you likely picked mis-matched options<br>check [here](https://tesla-info.com/tesla-option-codes.php) for help setting up codes; test [here](https://static-assets.tesla.com/configurator/compositor?model=&view=&options=&bkba_opt=1)
|   `model`                     | `MS`          | options: `MS`, `MX`, `MY`, `M3`, `CT`(?)
|   `view`                      | `STUD_3QTR`   | options: `STUD_3QTR`, `STUD_SEAT`, `STUD_SIDE`, `STUD_REAR`, `STUD_WHEEL`<br>each requires specific `options`
|   `options`                   | `DV4W,INBFP,MTS08,PPMR,WT19` | defaults make a red Model S. See [option codes](https://tesla-api.timdorr.com/vehicle/optioncodes) for more options.
|   `verticalOffset`            | `0` pixels    |
|   `imageOpacity`              | `0.2`         | range: `0.0 - 1.0` fractional opacity
|**Additional Items**           |
|`homeRadius`                   | `100` varies  | shall be the same units as earthRadius option<br>default value is 100 meters. see `earthRadius`
|`earthRadius`                  | `6371000` varies | assumed earth radius for approximate distance from home calcs<br>default is the earth radius in meters but you can convert homeRadius and earthRadius to mi if desired (they shall be the same units, there is no conversion) 
|`showDebug`                    | `false`       | `true` turns on a bunch of troubleshooting items, crazy icons, etc.
|`showVerboseConsole`           | `true`        | 'false' turns off the MM console logs
|`showTable`                    | `false`       | `true` would enable untested legacy MMM-TeslaMate table feature
|`showTableOdometer`            | `true`        | `true` shows odometer on legacy table

* Note: Warning icons for low tire pressure (squish tire), open doors (car door) and windows (poorly svg'd car window with up arrow) are currently not configurable.
