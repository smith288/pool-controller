// main.js

document.addEventListener('DOMContentLoaded', () => {

  const socket = io();
  const STORAGE_KEY = 'poolControllerStates';
  
  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <p>Waiting for change...</p>
      <div class="loader"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Track pending switches
  const pendingSwitches = new Set();
  
  // Load saved states and apply them immediately
  function loadSavedStates() {
    try {
      const savedStates = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.entries(savedStates).forEach(([key, value]) => {
        const toggle = document.querySelector(`input[data-type="${key}"]`);
        if (toggle) {
          toggle.checked = value;
          const statusLabel = toggle.closest('.control-item').querySelector('.status-label');
          if (statusLabel) {
            if (key === 'spa_pool') {
              statusLabel.textContent = value ? 'Spa' : 'Pool';
            } else {
              statusLabel.textContent = value ? 'On' : 'Off';
            }
          }
          
          // If this is the filter toggle, update spa_pool toggle state
          if (key === 'filter') {
            const spaPoolToggle = document.querySelector('input[data-type="spa_pool"]');
            if (spaPoolToggle) {
              spaPoolToggle.disabled = !value;
            }
          }
        }
      });
    } catch (e) {
      console.error('Error loading saved states:', e);
    }
  }
  
  // Save states to localStorage
  function saveStates(states) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
      console.error('Error saving states:', e);
    }
  }
  
  // Load saved states immediately
  loadSavedStates();
  
  document.querySelectorAll('.toggle-input').forEach(toggle => {
    toggle.addEventListener('change', function() {
      if (pendingSwitches.has(this.dataset.type)) {
        return; // Prevent double-toggles
      }

      const switchType = this.dataset.type;
      const newStatus = this.checked ? 'On' : 'Off';

      // Show modal and disable toggle
      modal.style.display = 'block';
      this.disabled = true;
      pendingSwitches.add(switchType);

      // Send the toggle request to the server
      socket.emit('toggleSwitch', {switchType, newStatus});

      // Set timeout for error handling (reduced to 30 seconds to match server)
      setTimeout(() => {
        if (pendingSwitches.has(switchType)) {
          pendingSwitches.delete(switchType);
          modal.style.display = 'none';
          this.disabled = false;
          this.checked = !this.checked; // Revert the toggle
          
          // Update localStorage with the reverted state
          const states = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          states[switchType] = this.checked;
          saveStates(states);
          
          alert('Switch toggle timed out. Please try again.');
        }
      }, 30000);
    });
  });

  // Add new switch response handler
  socket.on('switchResponse', (response) => {
    const toggle = document.querySelector(`input[data-type="${response.type}"]`);
    if (toggle) {
      if (response.success) {
        // Update the toggle state
        toggle.checked = response.status === 'On';
        toggle.disabled = false;
        
        // Update status label
        const statusLabel = toggle.closest('.control-item').querySelector('.status-label');
        if (statusLabel) {
          statusLabel.textContent = response.status;
        }
      } else {
        // Revert the toggle on error
        toggle.checked = !toggle.checked;
        toggle.disabled = false;
        alert(`Failed to toggle ${response.type}: ${response.error}`);
      }
      
      // Clear pending state
      pendingSwitches.delete(response.type);
      modal.style.display = 'none';
      
      // Update localStorage
      const states = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      states[response.type] = toggle.checked;
      saveStates(states);
    }
  });

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('displayUpdate', (displayText) => {
    console.log('Received displayUpdate:', displayText);
    updateLEDDisplay(displayText);
  });

  function updateLEDDisplay(displayText) {
    const ledDisplay = document.getElementById('led-display');
    if (ledDisplay) {
      // Pad the display text to maintain consistent width
      const displayString = displayText.display || JSON.stringify(displayText);
      const paddedText = displayString.padEnd(20, ' '); // Assuming 20 character display width
      ledDisplay.textContent = paddedText;
    } else {
      console.error('LED display element not found');
    }
  }

  // Update the statusUpdate handler to save states
  socket.on('statusUpdate', (statuses) => {
    const savedStates = {};
    Object.entries(statuses).forEach(([key, value]) => {
      savedStates[key] = value;
      const toggle = document.querySelector(`input[data-type="${key}"]`);
      if (toggle) {
        toggle.checked = value;
        toggle.disabled = false;
        
        // Update status label
        const statusLabel = toggle.closest('.control-item').querySelector('.status-label');
        if (statusLabel) {
          if (key === 'spa_pool') {
            statusLabel.textContent = value ? 'Spa' : 'Pool';
          } else {
            statusLabel.textContent = value ? 'On' : 'Off';
          }
        }
        
        // If this is the filter toggle, update spa_pool toggle state
        if (key === 'filter') {
          const spaPoolToggle = document.querySelector('input[data-type="spa_pool"]');
          if (spaPoolToggle) {
            spaPoolToggle.disabled = !value;
          }
        }
        
        // Clear pending state if this was a pending switch
        if (pendingSwitches.has(key)) {
          pendingSwitches.delete(key);
          modal.style.display = 'none';
        }
      }
    });
    saveStates(savedStates);
  });

  // Control pad handling
  const dpad = document.querySelector('.d-pad');
  
  if (dpad) {
    // Handle button clicks
    dpad.addEventListener('click', (e) => {
      const button = e.target.closest('.d-pad-button');
      if (!button) return;
      
      const direction = button.dataset.direction;
      handleDirectionPress(direction);
    });

    // Handle keyboard controls
    document.addEventListener('keydown', (e) => {
      let direction = null;
      
      switch (e.key) {
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
        case 'Enter':
        case ' ':
          direction = 'menu';
          break;
      }
      
      if (direction) {
        e.preventDefault();
        const button = document.querySelector(`.d-pad-button.${direction}`);
        if (button) {
          button.classList.add('pressed');
          handleDirectionPress(direction);
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      let direction = null;
      
      switch (e.key) {
        case 'ArrowUp':
          direction = 'up';
          break;
        case 'ArrowDown':
          direction = 'down';
          break;
        case 'ArrowLeft':
          direction = 'left';
          break;
        case 'ArrowRight':
          direction = 'right';
          break;
        case 'Enter':
        case ' ':
          direction = 'menu';
          break;
      }
      
      if (direction) {
        const button = document.querySelector(`.d-pad-button.${direction}`);
        if (button) {
          button.classList.remove('pressed');
        }
      }
    });

    // Add touch support for mobile
    dpad.addEventListener('touchstart', (e) => {
      const button = e.target.closest('.d-pad-button');
      if (!button) return;
      
      e.preventDefault();
      button.classList.add('pressed');
    });

    dpad.addEventListener('touchend', (e) => {
      const button = e.target.closest('.d-pad-button');
      if (!button) return;
      
      e.preventDefault();
      button.classList.remove('pressed');
      const direction = button.dataset.direction;
      handleDirectionPress(direction);
    });
  }

  function handleDirectionPress(direction) {
    console.log('Direction pressed:', direction);
    
    // Add visual feedback
    const button = document.querySelector(`.d-pad-button.${direction}`);
    if (button) {
      button.classList.add('pressed');
      
      // Remove pressed class after animation
      setTimeout(() => {
        button.classList.remove('pressed');
      }, 200);
    }
    
    // Emit the direction press to the server
    socket.emit('directionPress', { direction });
  }

  // Add this to your existing socket listeners
  socket.on('buttonResponse', (response) => {
    const button = document.querySelector(`.d-pad-button.${response.direction}`);
    if (button) {
      if (!response.success) {
        // Visual feedback for error
        button.classList.add('error');
        setTimeout(() => {
          button.classList.remove('error');
        }, 500);
        
        console.error('Button press failed:', response.error);
      }
    }
  });
});