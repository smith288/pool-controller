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
            lights: false
        };
        this.currentLEDDisplay = '';

        this.reconnecting = false;
        this.reconnectAttempts = 0;

        console.log('SerialHandler initialized with states:', this.currentStatuses);

        // Initialize MQTT
        this.mqttHandler = new MQTTHandler(mqtt_host, mqtt_port);
        
        // Handle MQTT commands
        this.mqttHandler.onCommand((feature) => {
            console.log('Received MQTT command for feature:', feature);
            const currentState = this.currentStatuses[feature];
            if (currentState !== undefined) {
                this.sendCommand(feature, !currentState, true);
            }
        });

        this.connect();
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
        const statuses = {};

        for (let i = 0; i < LED_MASK.length; i++) {
            const ledByte = ledBytes[i];
            const ledBits = LED_MASK[i];
            ledBits.forEach(({ bit, name }) => {
                statuses[name] = (ledByte & bit) !== 0;
            });
        }

        this.currentStatuses = statuses;
        this.modelTimestamp = Date.now();
        this.commandHandler.lastModelTimestampSeen = this.modelTimestamp;

        this.emit('ledStatus', statuses);
        // Emit an event when statuses change
        this.emit('statusUpdate', this.currentStatuses);
        
        if (this.commandHandler.sendingMessage) {
            const parameter = this.commandHandler.parameter;
            const targetState = this.commandHandler.targetState;
            const currentState = this.getParameterState(parameter);

            if (currentState === undefined || currentState === targetState) {
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
        
        panel_obj["display"] = text.replace('_F', '');
        switch (true) {
            case text.indexOf('NO CONNECTION') > -1:
                panel_obj["status"] = "No Connection";
                break;
            case text.indexOf('Pool Temp') > -1:
                text = text.replace('Pool Temp', '');
                text = text.replace('_', '') + 'ª';
                panel_obj["pooltemp"] = text.trim();
                break;
            case text.indexOf('Spa Temp') > -1:
                text = text.replace('Spa Temp', '');
                text = text.replace('_', '') + 'ª';
                panel_obj["spatemp"] = text.trim();
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
            this.commandHandler.currentLEDDisplay = panel_obj;
            // Store the current LED display in the session
            this.emit("displayUpdate", panel_obj);
            console.log('Display text:', JSON.stringify(panel_obj));
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

    sendCommand(commandID, targetState, confirm = true) {
        if (this.commandHandler.sendingMessage) {
            console.error('Already sending a message.');
            return;
        }
        this.commandHandler.initiateSend(commandID, targetState, confirm);

        // Log the command being sent
        console.log(`Sending command for "${commandID}":`, this.commandHandler.fullCommand);

        this.socket.write(this.commandHandler.fullCommand, (err) => {
            if (err) {
                console.error('Error sending command:', err);
            } else {
                console.log(`Command "${commandID}" sent successfully.`);
                if (!confirm) {
                    // If no confirmation is required, emit status update immediately
                    this.currentStatuses[commandID] = targetState;
                    this.emit('statusUpdate', this.currentStatuses);
                }
            }
        });
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
}

module.exports = SerialHandler;
