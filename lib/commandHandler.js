// commandHandler.js

const {
    MAX_SEND_ATTEMPTS,
    DLE,
    STX,
    ETX,
    FRAME_TYPE_LOCAL_TOGGLE,
    buttonToggle,
    buttonsMenu,
    buttonValue,
} = require('./constants');

class CommandHandler {
    constructor() {
        this.parameter = '';
        this.targetState = '';
        this.sendAttempts = 0;
        this.sendingMessage = false;
        this.lastModelTimestampSeen = 0;
        this.fullCommand = Buffer.alloc(0);
        this.keepAliveCount = 0;
        this.confirm = true;
    }

    initiateSend(commandID, commandState, confirm = true) {
        // Use the pre-defined full command
        const fullCommand = buttonValue[commandID];

        if (!fullCommand) {
            console.error(`Command "${commandID}" not found in buttonValue.`);
            return;
        }

        this.fullCommand = fullCommand;
        this.keepAliveCount = 0;
        this.sendingMessage = true;
        this.parameter = commandID;
        this.targetState = commandState;
        this.sendAttempts = 0;

        console.log(`Initiated sending command for "${commandID}"`);
    }

    sendAttemptsRemain() {
        if (this.sendAttempts >= MAX_SEND_ATTEMPTS) {
            console.error(`Command failed after ${MAX_SEND_ATTEMPTS} attempts.`);
            this.sendingMessage = false;
            return false;
        }
        this.sendAttempts += 1;
        console.info(`Command send attempt ${this.sendAttempts}.`);
        return true;
    }

    calculateChecksum(buffer) {
        let checksum = 0;
        for (const byte of buffer) {
            checksum += byte;
        }
        console.log(`Calculated checksum: 0x${checksum.toString(16).padStart(4, '0')}`);

        const checksumBuffer = Buffer.alloc(2);
        checksumBuffer.writeUInt16BE(checksum & 0xffff, 0);
        return checksumBuffer;
    }

    escapeDLE(buffer) {
        const escapedBufferArray = [];
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            escapedBufferArray.push(byte);
            if (byte === 0x10 && i >= 2) {
                escapedBufferArray.push(0x00);
            }
        }
        return Buffer.from(escapedBufferArray);
    }
}

module.exports = CommandHandler;
