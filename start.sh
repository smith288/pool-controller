#!/bin/bash

export POOL_CONTROLLER_PORT=5001
export NODE_ENV=development #production
export RS485_DEVICE_IP=10.155.1.19
export RS485_DEVICE_PORT=8899
export MQTT_HOST=homebridge
export MQTT_PORT=1883

node "$(pwd)/app.js"
