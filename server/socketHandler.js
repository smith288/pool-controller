// server/socketHandler.js

function socketHandler(io, serialHandler) {
    io.on('connection', (socket) => {
      console.log('New client connected');
  
      // Send initial status
      socket.emit('statusUpdate', serialHandler.currentStatuses);
  
      socket.on('toggleSwitch', (switchObject) => {
        console.log('Switch toggle request received:', switchObject);
        
        // Get current state before sending command
        const currentState = serialHandler.currentStatuses[switchObject.switchType];
        const targetState = switchObject.newStatus === 'On';
        
        if (currentState === targetState) {
          console.log('Switch already in desired state');
          socket.emit('switchResponse', {
            type: switchObject.switchType,
            success: true,
            status: switchObject.newStatus
          });
          return;
        }

        try {
          const success = serialHandler.toggleSwitch(switchObject);
          if (success) {
            socket.emit('switchResponse', {
              type: switchObject.switchType,
              success: true,
              status: switchObject.newStatus
            });
          } else {
            socket.emit('switchResponse', {
              type: switchObject.switchType,
              success: false,
              error: 'Failed to toggle switch'
            });
          }
        } catch (error) {
          socket.emit('switchResponse', {
            type: switchObject.switchType,
            success: false,
            error: error.message
          });
        }
      });

      socket.on('directionPress', (data) => {
        console.log('Direction pressed:', data.direction);
        
        // Map directions to commands
        let command = data.direction;
        if (command) {
          try {
            // If one of the menu buttons (left, right, up, down) are pressed, there is no target state
            if (command === 'left' || command === 'right' || command === 'up' || command === 'down') {
              // Send the button command - false means no confirmation needed
              serialHandler.sendCommand(command, null, false);              
            } else {
              // Send the button command - false means no confirmation needed
              serialHandler.sendCommand(command, true, false);
            }
            socket.emit('buttonResponse', {
              direction: data.direction,
              success: true
            });
          } catch (error) {
            console.error('Error sending button command:', error);
            socket.emit('buttonResponse', {
              direction: data.direction,
              success: false,
              error: error.message
            });
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });
  
    serialHandler.on('statusUpdate', (statuses) => {
      io.emit('statusUpdate', statuses);
    });
    
    serialHandler.on('displayUpdate', (statuses) => {
      io.emit('displayUpdate', statuses);
    });
}

module.exports = socketHandler;
  