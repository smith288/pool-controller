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

        // Map direction commands to button values
        this.buttonCommands = {
            'UP': buttonValue.plus,
            'DOWN': buttonValue.minus,
            'LEFT': buttonValue.left,
            'RIGHT': buttonValue.right,
            'MENU': buttonValue.menu
        };
    }

    initiateSend(parameter, targetState, confirm = true) {
        // Handle button commands
        // if (this.buttonCommands[parameter]) {
        //     this.fullCommand = Buffer.concat([
        //         Buffer.from([DLE, STX]),
        //         FRAME_TYPE_LOCAL_TOGGLE,  // Use existing frame type
        //         this.buttonCommands[parameter],
        //         Buffer.from([0x00]),  // Checksum placeholder
        //         Buffer.from([DLE, ETX])
        //     ]);
            
        //     // Calculate checksum
        //     let checksum = 0;
        //     for (let i = 2; i < this.fullCommand.length - 3; i++) {
        //         checksum ^= this.fullCommand[i];
        //     }
        //     this.fullCommand[this.fullCommand.length - 3] = checksum;
            
        //     return;
        // }

        // Use the pre-defined full command
        const fullCommand = buttonValue[parameter.toLowerCase()];

        if (!fullCommand) {
            console.error(`Command "${parameter}" not found in buttonValue.`);
            return;
        }

        this.fullCommand = fullCommand;
        this.keepAliveCount = 0;
        this.sendingMessage = true;
        this.parameter = parameter;
        this.targetState = targetState;
        this.sendAttempts = 0;

        console.log(`Initiated sending command for "${parameter}"`);
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
