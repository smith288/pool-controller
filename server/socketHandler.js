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

        // Add command tracking
        const commandTimeout = setTimeout(() => {
          socket.emit('switchResponse', {
            type: switchObject.switchType,
            success: false,
            error: 'Command timed out'
          });
        }, 30000); // 30 second timeout

        // Listen for the status change
        const statusHandler = (statuses) => {
          if (statuses[switchObject.switchType] === targetState) {
            clearTimeout(commandTimeout);
            socket.emit('switchResponse', {
              type: switchObject.switchType,
              success: true,
              status: switchObject.newStatus
            });
            serialHandler.removeListener('statusUpdate', statusHandler);
          }
        };

        serialHandler.on('statusUpdate', statusHandler);
        
        // Send the command
        try {
          serialHandler.sendCommand(switchObject.switchType, targetState, true);
        } catch (error) {
          clearTimeout(commandTimeout);
          socket.emit('switchResponse', {
            type: switchObject.switchType,
            success: false,
            error: error.message
          });
          serialHandler.removeListener('statusUpdate', statusHandler);
        }
      });

      socket.on('directionPress', (data) => {
        console.log('Direction pressed:', data.direction);
        // Handle the direction press here
        // You can add specific logic for each direction
        switch(data.direction) {
          case 'up':
            // Handle up press
            break;
          case 'down':
            // Handle down press
            break;
          case 'left':
            // Handle left press
            break;
          case 'right':
            // Handle right press
            break;
          case 'menu':
            // Handle menu press
            break;
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
  