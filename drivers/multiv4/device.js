'use strict';

const ZigBeeDeviceDebug = require('../../lib/ZigBeeDeviceDebug');

/*
	cluster genBinaryInput value = 1 => button inside pressed
	cluster genBinaryInput value = 0 => button inside not pressed

	cluster msTemperatureMeasurement measuredValue => temperature in centigrades (?)

	cluster ssIasZone zoneStatus = 32 => window/door closed (bit 0x1)
	cluster ssIasZone zoneStauts = 33 => window/door open (bit 0x1)
*/

class MultiSensorDevice extends ZigBeeDeviceDebug {

	convertVoltageToPct(voltage) {
		var batteryMap = {
			'28': 100, '27': 100, '26': 100, '25': 90, '24': 90, '23': 70,
			'22': 70, '21': 50, '20': 50, '19': 30, '18': 30, '17': 15, '16': 1, '15': 0
		};

		var minVolts = 15;
		var maxVolts = 28;

		var volt = Math.round(voltage);

		if (volt > maxVolts) {
			volt = maxVolts;
		}

		if (volt < minVolts) {
			volt = minVolts;
		}

		var pct = batteryMap[volt.toString()];

		if (pct == null || pct == undefined || typeof (psct) == 'undefined') {
			return null;
		}

		return pct / 100;
	}

	onMeshInit() {
		this.log('MultiSensorDevice (multiv4) has been inited');

		/*
		this.log('configuring treshold for motion');
		this.node.endpoints[0].clusters[0xFC02].write(0x0000, 0x01);
		this.node.endpoints[0].clusters[0xFC02].write(0x0002, 0x0276);
		this.node.endpoints[0].clusters[0xFC02].report(0x0010, 1800, 3600, 1, function (err, data) { console.log('0x0010 changed! - ' + err + data); }).catch(e => { this.log('faile to') });
		this.node.endpoints[0].clusters[0xFC02].report(0x0012, 1800, 3600, 1, function (err, data) { console.log('0x0012 changed! - ' + err + data); }).catch(e => { this.log('faile to') });

		var a = this.node.endpoints[0].clusters[0xFC02];

		console.log(a);
		
		this.log('configuring treshold for motion');
		*/

		this.printNode();

		this.attachDebugListeners(['msTemperatureMeasurement/measuredValue', 'genPowerCfg/batteryVoltage', 'ssIasZone/zoneStatus', 'genPollCtrl/*']);

		this.batteryThreshold = 17;

		this.registerCapability('measure_temperature', 'msTemperatureMeasurement', {
			get: 'measuredValue',
			getOpts: {
				getOnStart: true,
				getOnOnline: true
			}
		});

		this.registerCapability('measure_battery', 'genPowerCfg', {
			get: 'batteryVoltage',
			getOpts: {
				getOnStart: true,
				getOnOnline: true
			},
			getParser: this.convertVoltageToPct.bind(this)
		});

		this.registerCapability('alarm_contact', 'ssIasZone', {
			get: 'zoneStatus',
			getOpts: {
				getOnOnline: true,
				getOnStart: true
			},
			getParser: value => {

				this.log('reading zoneStatus');

				if (value == null || value == undefined || typeof (value) == 'undefined') {
					return undefined;
				}

				return (value & 0x1) == (0x1);
			}
		});

		//this.registerCapability('alarm_motion', '64514', '');

		this.registerAttrReportListener('ssIasZone', 'zoneStatus', 1, 3600, null, value => {

			this.log('zoneStatus changed');

			if (value == null || value == undefined || typeof (value) == 'undefined') {
				return undefined;
			}

			this.setCapabilityValue('alarm_contact', (value & 0x1) == (0x1));
		}).catch(
			e => {
				this.log('failed to registerAtrReportListener for zone status change' + e);
				this.log(e);
			});

		this.registerAttrReportListener('genPowerCfg', 'batteryVoltage', 1, 3600, null, data1 => {
			this.log('batteryVoltage', data1);
			if (data1 <= this.batteryThreshold) {
				this.setCapabilityValue('alarm_battery', true);
			} else {
				this.setCapabilityValue('alarm_battery', false);
			}

			var pct = this.convertVoltageToPct(data1);

			if (pct != null && typeof (pct) != 'undefined') {
				this.setCapabilityValue('batteryPercentageRemaining', pct / 100);
			}

		}, 0).catch(
			e => {
				this.log('failed to registerAtrReportListener for battery voltage' + e);
				this.log(e);
			});

		this.minReportTemp = /*this.getSetting('minReportTemp') ||*/ 1800;
		this.maxReportTemp = /*this.getSetting('maxReportTemp') ||*/ 3600;

		/*
		this.registerAttrReportListener('msTemperatureMeasurement', 'measuredValue', this.minReportTemp, this.maxReportTemp, 10, data2 => {
			this.log('measuredValue temperature', data2);
			const temperature = Math.round((data2 / 100) * 10) / 10;
			this.setCapabilityValue('measure_temperature', temperature);
		}, 0).catch(
			e => {
				this.log('failed to registerAtrReportListener for temperature sensor' + e + " type: " + typeof (e));
				this.log(e);
			});
			*/
	}

}

module.exports = MultiSensorDevice;
