// serialHandler.js

const net = require('net');
const CommandHandler = require('./commandHandler');
const EventEmitter = require('events');
const {
    DLE,
    STX,
    ETX,
    FRAME_TYPE_KEEPALIVE,
    FRAME_TYPE_LEDS,
    FRAME_TYPE_DISPLAY,
    FRAME_TYPE_DISPLAY_SERVICE,
    FRAME_TYPE_SERVICE_MODE,
    FRAME_TYPE_LOCAL_TOGGLE,
    LED_MASK,
} = require('./constants');
const MQTTHandler = require('./mqttHandler');

class SerialHandler extends EventEmitter {
    constructor(socket_ip, socket_port, mqtt_host = 'localhost', mqtt_port = 1883) {
        super();
        this._host = socket_ip;
        this._port = parseInt(socket_port, 10);
        this.socket = new net.Socket();

        this.buffer = Buffer.alloc(0);
        this.buffer_full = false;
        this.looking_for_start = true;
        this.ready_to_send = false;

        this.commandHandler = new CommandHandler();
        this.modelTimestamp = 0;
        this.currentStatuses = {
            spa_pool: false,
            filter: false,
            lights: false,
            heater1: false,
            valve3: false,
            valve4: false,
            aux1: false,
            aux2: false,
            aux3: false,
            aux4: false,
            aux5: false,
            aux6: false,
            aux7: false,
            service: false
        };
        this.currentLEDDisplay = '';
        this.previousLEDDisplay = '';
        this.reconnecting = false;
        this.reconnectAttempts = 0;

        // Add temperature control state
        this.currentTemperatures = {
            spa: 0,
            pool: 0,
            water: 0,
            air: 0
        };

        console.log('SerialHandler initialized with states:', this.currentStatuses);

        // Initialize MQTT
        this.mqttHandler = new MQTTHandler(mqtt_host, mqtt_port);
        
        // Handle MQTT commands
        this.mqttHandler.onCommand((feature, data) => {
            console.log('Received MQTT command for feature:', feature, data);
            if (feature === 'temp_control') {
                if (data.spatemp !== undefined) {
                    this.setTemperature('spa', data.spatemp);
                } else if (data.pooltemp !== undefined) {
                    this.setTemperature('pool', data.pooltemp);
                }
            } else {
                const currentState = this.currentStatuses[feature];
                if (currentState !== undefined) {
                    this.sendCommand(feature, !currentState, true);
                }
            }
        });

        this.connect();
        
        // Initialize temperatures after connection
        this.socket.on('connect', async () => {
            console.log('Connected to device, initializing temperatures...');
            try {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.initializeTemperatures();
            } catch (error) {
                console.error('Error initializing temperatures:', error);
            }
        });
    }

    connect() {
        this.socket.connect(this._port, this._host, () => {
            console.log('Connected to the device');
            this.socket.setTimeout(1000);
        });

        this.socket.on('data', (data) => {
            this.handleData(data);
        });

        this.socket.on('error', (err) => {
            console.error('Socket error:', err);
            this.reconnect();
        });

        this.socket.on('timeout', () => {
            console.warn('Socket timeout');
            this.socket.end();
            this.reconnect();
        });

        this.socket.on('close', (hadError) => {
            console.log('Socket closed', hadError ? 'due to error' : '');
            this.reconnect();
        });
    }

    handleData(data) {
        // console.log('Received data:', data);
        this.buffer = Buffer.concat([this.buffer, data]);

        let startIdx = 0;
        while (startIdx < this.buffer.length) {
            if (this.buffer[startIdx] === 0x10 && this.buffer[startIdx + 1] === 0x02) {
                const endIdx = this.buffer.indexOf(Buffer.from([0x10, 0x03]), startIdx + 2);
                if (endIdx !== -1) {
                    const frame = this.buffer.slice(startIdx, endIdx + 2);
                    this.processFrame(frame);
                    this.buffer = this.buffer.slice(endIdx + 2);
                    startIdx = 0;
                } else {
                    break;
                }
            } else {
                startIdx++;
            }
        }
    }

    processFrame(frame) {
        const payload = frame.slice(2, -2);
        const frameType = payload.slice(0, 2);

        if (frameType.equals(FRAME_TYPE_LEDS)) {
            this.handleLEDFrame(payload);
        } else if (frameType.equals(FRAME_TYPE_DISPLAY)) {
            this.handleDisplayFrame(payload);
        } else if (frameType.equals(FRAME_TYPE_KEEPALIVE)) {
            this.handleKeepAliveFrame();
        } else {
            // console.log('Unknown frame type:', frameType);
        }
    }

    async handleLEDFrame(payload) {
        const ledBytes = payload.slice(2);
        const newStatuses = {};

        // Process LED mask to get new statuses
        for (let i = 0; i < LED_MASK.length; i++) {
            const ledByte = ledBytes[i];
            const ledBits = LED_MASK[i];
            ledBits.forEach(({ bit, name }) => {
                newStatuses[name] = (ledByte & bit) !== 0;
            });
        }

        // Merge new statuses with existing ones to preserve spa_pool state
        this.currentStatuses = {
            ...this.currentStatuses,
            ...newStatuses
        };

        this.modelTimestamp = Date.now();
        this.commandHandler.lastModelTimestampSeen = this.modelTimestamp;

        this.emit('ledStatus', this.currentStatuses);
        this.emit('statusUpdate', this.currentStatuses);
        
        if (this.commandHandler.sendingMessage) {
            const parameter = this.commandHandler.parameter;
            const targetState = this.commandHandler.targetState;
            const currentState = this.getParameterState(parameter);

            if (currentState === undefined || currentState === targetState || this.commandHandler.currentLEDDisplay.display != this.commandHandler.previousLEDDisplay.display) {
                console.log(`Command "${parameter}" acknowledged.`);
                this.commandHandler.sendingMessage = false;
            } else {
                await setTimeout(()=> {
                    console.log('waiting for a blip...');
                }, 500);
                console.log(`Command "${parameter}" not acknowledged yet. Still: ${currentState}`);
            }
        }

        // Publish status to MQTT
        this.mqttHandler.publishStatus(
            this.currentStatuses,
            this.commandHandler.currentLEDDisplay
        );
    }

    handleDisplayFrame(payload) {
        var panel_obj = {};
        var text = payload.slice(2, -4).toString('ascii').trim();
        
        // Format display text - replace 2 or more spaces with a dash
        const formattedText = text.replace(/\s{2,}/g, ' - ').replace('_F', '');
        panel_obj["display"] = formattedText;

        // Handle special cases
        switch (true) {
            case text.indexOf('NO CONNECTION') > -1:
                panel_obj["status"] = "No Connection";
                break;
            case text.indexOf('Pool Temp') > -1:
                text = text.replace('Pool Temp', '');
                text = text.replace('_', '') + 'ª';
                panel_obj["pooltemp"] = text.trim();
                this.currentTemperatures.pool = parseInt(text.trim(), 10);
                break;
            case text.indexOf('Spa Temp') > -1:
                text = text.replace('Spa Temp', '');
                text = text.replace('_', '') + 'ª';
                panel_obj["spatemp"] = text.trim();
                this.currentTemperatures.spa = parseInt(text.trim(), 10);
                break;
            case text.indexOf('Air Temp') > -1:
                text = text.replace('Air Temp', '');
                text = text.replace('_', '') + 'ª';
                panel_obj["airtemp"] = text.trim();
                break;
            case text.indexOf('Pool Chlorinator') > -1:
                text = text.replace('Pool Chlorinator', '');
                panel_obj["poolchlorinator"] = text.trim();
                break;
            case text.indexOf('Salt Level') > -1:
                text = text.replace('Salt Level', '');
                panel_obj["saltlevel"] = text.trim();
                break;
            case text.indexOf('Filter Speed') > -1:
                text = text.replace('Filter Speed', '');
                panel_obj["filterspeed"] = text.trim();
                break;
            case text.indexOf('Heater1') > -1:
                text = text.replace('Heater1', '');
                panel_obj["heater1"] = text.trim();
                break;
            default:
                break;
        }

        if (JSON.stringify(this.commandHandler.currentLEDDisplay) != JSON.stringify(panel_obj)){
            this.commandHandler.previousLEDDisplay = this.commandHandler.currentLEDDisplay;
            this.commandHandler.currentLEDDisplay = panel_obj;
            // Store the current LED display in the session
            this.emit("displayUpdate", panel_obj);
            //console.log('Display text:', JSON.stringify(panel_obj));
        }
    }

    async handleKeepAliveFrame() {
        if (this.commandHandler.sendingMessage) {
            this.commandHandler.keepAliveCount += 1;
            if (this.commandHandler.keepAliveCount >= 2) {
                if (this.commandHandler.sendAttemptsRemain()) {
            
                    this.socket.write(this.commandHandler.fullCommand);
                    this.commandHandler.keepAliveCount = 0;
                    
                } else {
                    console.error(`Failed to send command "${this.commandHandler.parameter}".`);
                }
            }
        }
    }

    getParameterState(parameter) {
        return this.currentStatuses[parameter];
    }

    async sendCommand(commandID, targetState, waitForAck = false) {
        if (this.commandHandler.sendingMessage) {
            console.error(`Already sending a message. Command: "${this.commandHandler.parameter}"`);
            return;
        }
        this.commandHandler.initiateSend(commandID, targetState);

        // Log the command being sent
        console.log(`Sending command for "${commandID}":`, this.commandHandler.fullCommand);

        this.socket.write(this.commandHandler.fullCommand, (err) => {
            if (err) {
                console.error('Error sending command:', err);
            } else {
                console.log(`Command "${commandID}" sent successfully.`);
                setTimeout(() => {
                    this.currentStatuses[commandID] = targetState;
                    this.emit('statusUpdate', this.currentStatuses);            
                }, 1000);
            }
        });

        if (waitForAck) {
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (!this.commandHandler.sendingMessage) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
        }
    }

    reconnect() {
        if (this.reconnecting) return;
        this.reconnecting = true;

        console.log('Attempting to reconnect...');
        this.socket.destroy();

        setTimeout(() => {
            this.socket.connect(this._port, this._host, () => {
                console.log('Reconnected to the device');
                this.reconnecting = false;
            });
        }, 1000);
    }

    // Add cleanup for MQTT
    close() {
        this.mqttHandler.close();
        this.socket.destroy();
    }

    async toggleSwitch(switchObject) {
        const { switchType, newStatus } = switchObject;
        const targetState = newStatus === 'On';

        // Log the toggle request
        console.log(`Toggling ${switchType} to ${newStatus} (${targetState})`);

        try {
            // Send the command
            await this.sendCommand(switchType, targetState, true);
            
            // Update the local state
            this.currentStatuses[switchType] = targetState;
            
            // Emit the status update
            this.emit('statusUpdate', this.currentStatuses);
            
            return true;
        } catch (error) {
            console.error(`Error toggling ${switchType}:`, error);
            return false;
        }
    }

    async getHeaterTemp(type) {
        // Navigate to settings menu
        await this.navigateToSettingsMenu();

        // Navigate to correct heater menu
        if (type === 'spa') {
            await this.sendCommand('right', null, true);
        } else {
            await this.sendCommand('right', null, true);
            await new Promise(resolve => setTimeout(resolve, 1500));
            await this.sendCommand('right', null, true);
        }

        // Wait for display to update
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Get current temperature
        const currentTemp = await this.getCurrentDisplayTemp(); 
        return currentTemp;
    }

    async setTemperature(type, targetTemp) {
        console.log(`Setting ${type} temperature to ${targetTemp}`);
        
        // Navigate to settings menu
        await this.navigateToSettingsMenu();
        
        // Navigate to correct heater menu
        if (type === 'spa') {
            // Navigate to Spa Heater1
            await this.sendCommand('right', null, true);
        } else {
            // Navigate to Pool Heater1 (requires two right presses)
            await this.sendCommand('right', null, true);
            await new Promise(resolve => setTimeout(resolve, 1500));
            await this.sendCommand('right', null, true);
        }
        
        // Wait for display to update
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Read current temperature and adjust
        const currentTemp = await this.getCurrentDisplayTemp();
        if (currentTemp !== null) {
            const diff = targetTemp - currentTemp;
            const button = diff > 0 ? 'plus' : 'minus';
            const presses = Math.abs(diff);
            
            // Adjust temperature
            for (let i = 0; i < presses; i++) {
                await this.sendCommand(button, null, true);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        // Exit menus by pressing menu twice
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.sendCommand('menu', null, true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.sendCommand('menu', null, true);
    }

    async getCurrentDisplayTemp() {
        const maxAttempts = 10;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const display = this.commandHandler.currentLEDDisplay;
            if (!display) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                attempts++;
                continue;
            }

            const displayText = display.display;
            console.log('Current display:', displayText);

            // Check for temperature display format: "X Heater1 - ##"
            // where X is either "Spa" or "Pool" and ## is the temperature
            if (displayText.match(/(Spa|Pool) Heater1 - \d+/)) {
                console.log('Found temperature text:', displayText);
                const match = displayText.match(/(\d+)$/);
                if (match) {
                    console.log('Found temperature:', match[1]);
                    return parseInt(match[1], 10);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1500));
            attempts++;
        }

        console.log('Timeout waiting for temperature display');
        return null;
    }

    async navigateToSettingsMenu() {
        
        // Navigate to Settings Menu
        let found = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!found && attempts < maxAttempts) {
            const display = this.commandHandler.currentLEDDisplay;
            if (display && display.display.toLowerCase().includes('settings - menu')) {
                console.log('Found settings menu');
                found = true;
            } else {
                console.log('Not in settings menu, trying again...');
                await this.sendCommand('menu', null, true);
                await new Promise(resolve => setTimeout(resolve, 1500));
                attempts++;
            }
        }
        
        if (!found) {
            throw new Error('Could not find Settings Menu');
        }
    }

    async navigateToDiagnosticsMenu() {
        
        // Navigate to Settings Menu
        let found = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!found && attempts < maxAttempts) {
            const display = this.commandHandler.currentLEDDisplay;
            if (display && display.display.toLowerCase().includes('diagnostic - menu')) {
                console.log('Found diagnostic menu');
                found = true;
            } else {
                console.log('Not in diagnostic menu, trying again...');
                await this.sendCommand('menu', null, true);
                attempts++;
            }
        }
        
        if (!found) {
            throw new Error('Could not find Diagnostic Menu');
        }
    }

    async getDiagnostics() {
        // Navigate to diagnostics menu
        await this.navigateToDiagnosticsMenu();

        // Get current temperature
        await this.sendCommand('right', null, true);
        const currentTemp = await this.getWaterSensorTemp();
        if (currentTemp === null) { 
            console.log('Timeout waiting for water sensor temperature');
            return null;
        }
        await this.sendCommand('right', null, true);
        const airTemp = await this.getAirSensorTemp();
        if (airTemp === null) {
            console.log('Timeout waiting for air sensor temperature');
            return null;
        }
        return {
            waterTemp: currentTemp,
            airTemp: airTemp
        };
    }

    async getWaterSensorTemp() {
        const maxAttempts = 10;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const display = this.commandHandler.currentLEDDisplay;
            if (!display) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
                continue;
            }

            const displayText = display.display;
            console.log('Current display:', displayText);

            if (displayText.match(/Water Sensor - \d+/)) {
                const match = displayText.match(/(\d+)$/);
                if (match) {
                    console.log('Found temperature:', match[1]);
                    return parseInt(match[1], 10);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        console.log('Timeout waiting for temperature display');
        return null;
    }

    async getAirSensorTemp() {
        const maxAttempts = 10;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            const display = this.commandHandler.currentLEDDisplay;
            if (!display) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
                continue;
            }

            const displayText = display.display;
            console.log('Current display:', displayText);

            if (displayText.match(/Air Sensor - \d+/)) {
                const match = displayText.match(/(\d+)$/);
                if (match) {
                    console.log('Found temperature:', match[1]);
                    return parseInt(match[1], 10);
                }
            }   

            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        console.log('Timeout waiting for temperature display');
        return null;
    }

    async initializeTemperatures() {
        try {

            // Get diagnostic temperatures
            console.log('Getting diagnostic temperatures...');
            const diagnostics = await this.getDiagnostics();
            this.currentTemperatures.water = diagnostics.waterTemp || 0;
            this.currentTemperatures.air = diagnostics.airTemp || 0;
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Get spa and pool temperatures
            console.log('Getting spa temperature...');
            const spaTemp = await this.getHeaterTemp('spa');
            this.currentTemperatures.spa = spaTemp || 0;
            await new Promise(resolve => setTimeout(resolve, 1500));

            console.log('Getting pool temperature...');
            const poolTemp = await this.getHeaterTemp('pool');
            this.currentTemperatures.pool = poolTemp || 0;
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Exit menus
            // await this.sendCommand('menu', null, false);
            // await new Promise(resolve => setTimeout(resolve, 1500));
            // await this.sendCommand('menu', null, false);

            // Emit temperature update
            this.emit('temperatureUpdate', this.currentTemperatures);
            console.log('Temperature initialization complete:', this.currentTemperatures);
        } catch (error) {
            console.error('Error in initializeTemperatures:', error);
        }
    }
}

module.exports = SerialHandler;
