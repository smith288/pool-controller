const mqtt = require('mqtt');

class MQTTHandler {
    constructor(host, port) {
        this.client = mqtt.connect(`mqtt://${host}:${port}`);
        this.topicStatus = 'pool/status';
        this.topicCommand = 'pool/command';

        this.client.on('connect', () => {
            console.log('Connected to MQTT broker');
            this.client.subscribe(this.topicCommand, (err) => {
                if (err) {
                    console.error('Error subscribing to pool/command:', err);
                } else {
                    console.log('Subscribed to pool/command');
                }
            });
        });

        this.client.on('error', (error) => {
            console.error('MQTT Error:', error);
        });
    }

    publishStatus(statuses, displayText) {
        const payload = {
            timestamp: new Date().toISOString(),
            features: statuses,
            display: displayText
        };

        this.client.publish(this.topicStatus, JSON.stringify(payload), { retain: true });
    }

    onCommand(callback) {
        this.client.on('message', (topic, message) => {
            if (topic === this.topicCommand) {
                try {
                    const command = JSON.parse(message.toString());
                    if (command.feature) {
                        callback(command.feature);
                    } else if (command.spatemp !== undefined || command.pooltemp !== undefined) {
                        // Handle temperature setting commands
                        callback('temp_control', command);
                    }
                } catch (error) {
                    console.error('Error parsing MQTT command:', error);
                }
            }
        });
    }

    close() {
        this.client.end();
    }
}

module.exports = MQTTHandler; 