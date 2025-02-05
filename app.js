// app.js

require('dotenv').config();
const SerialHandler = require('./lib/serialHandler');
const createServer = require('./server/index');
const express = require('express');
const session = require('express-session');
const path = require('path');

// Replace with your actual device IP and port
const DEVICE_IP = process.env.RS485_DEVICE_IP || '10.155.1.19';
const DEVICE_PORT = process.env.RS485_DEVICE_PORT || '8899';

// Add to your configuration section
const mqtt_host = process.env.MQTT_HOST || 'homebridge';
const mqtt_port = process.env.MQTT_PORT || 1883;

// Instantiate the SerialHandler
const serialHandler = new SerialHandler(
    DEVICE_IP, 
    DEVICE_PORT, 
    mqtt_host,
    mqtt_port
);

// Create and start the sockets and web server
const server = createServer(serialHandler);
const PORT = process.env.POOL_CONTROLLER_PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle the serial connection
serialHandler.socket.on('disconnect', () => {
    console.log('Disconnected from the device.');
    setTimeout(() => {
        serialHandler.reconnect();
    }, 5000);
});

// Set up event listeners
serialHandler.socket.on('connect', () => {
    // console.log('Connected to the device.');
    // Send a command to toggle the lights
    //   serialHandler.sendCommand('lights', true, true); // commandID, targetState, confirm

});

serialHandler.socket.on('error', (err) => {
    console.error('Socket error:', err.code);
});

const commandListener = () => {
    // Add in console input listener that will send commands to the device
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (text) => {

        var intendedState = '';
        var command = '';

        if (text.indexOf('=') !== -1) {
            intendedState = text.split('=')[1];
            command = `${text.split('=')[0]}\n`;
        } else {
            command = text;
        }
        switch (command) {
            case 'service\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('service', intendedState, true);
                }
                break;
            case 'pool\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('pool', intendedState, true);
                }
                break;
            case 'spa\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('spa', intendedState, true);
                }
                break;
            case 'spillover\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('spillover', intendedState, true);
                }
                break;
            case 'filter\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('filter', intendedState, true);
                }
                break;
            case 'lights\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('lights', intendedState, true);
                }
                break;
            case 'heater1\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('heater1', intendedState, true);
                }
                break;
            case 'valve3\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('valve3', intendedState, true);
                }
                break;
            case 'valve4\n':
                if (intendedState === '') {
                    console.log(`Current Service state: ${serialHandler.currentStatuses[text.trim()]}`);
                } else {
                    serialHandler.sendCommand('valve4', intendedState, true);
                }
                break;
            case 'quit\n':
            case 'exit\n':
            case 'q\n':
                done();
                break;
            case 'help\n':
                console.log('Commands:');
                console.log('service=<state> - Set the service state');
                console.log('pool=<state> - Set the pool state');
                console.log('spa=<state> - Set the spa state');
                console.log('spillover=<state> - Set the spillover state');
                console.log('filter=<state> - Set the filter state');
                console.log('lights=<state> - Set the lights state');
                console.log('heater1=<state> - Set the heater1 state');
                console.log('valve3=<state> - Set the valve3 state');
                console.log('valve4=<state> - Set the valve4 state');
                console.log('quit - Exit the program');
                break;
            case 'status\n':
                console.log('Current Pool status:', previousStatuses);
                break;
            default:
                console.log('Command not recognized.');
                break;
        }
    });


}

const done = () => {
    console.log('Quitting...');
    process.exit();
}


let previousStatuses = null;
serialHandler.on('ledStatus', (statuses) => {
    if (previousStatuses == null || JSON.stringify(statuses) !== JSON.stringify(previousStatuses)) {
        // console.log('LED statuses updated:', statuses);
        // Display what changed
        Object.keys(statuses).forEach((key) => {
            if (previousStatuses == null || (statuses[key] !== previousStatuses[key])) {
                console.log(`LED "${key}" set to:`, statuses[key]);
            }
        });
    }
    previousStatuses = statuses;
});
commandListener();

// Handle other events as needed

// Add cleanup handling
process.on('SIGINT', () => {
    console.log('Shutting down...');
    serialHandler.close();
    process.exit();
});

// Add or update the static file middleware
const app = express();
app.use(express.static('public'));

// Add this to your static file serving configuration
app.use('/fonts', express.static(path.join(__dirname, '../public/fonts'))); 

// Add session middleware before your routes
app.use(session({
  secret: 'pool-controller-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true if using HTTPS
}));

// Add body parser for JSON
app.use(express.json());