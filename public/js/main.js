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
    console.log('Connected to server, requesting initial state');
    socket.emit('requestInitialState');
  });

  socket.on('reconnect', () => {
    console.log('Reconnected to server, requesting current state');
    socket.emit('requestInitialState');
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

  // Update the statusUpdate handler
  socket.on('statusUpdate', (statuses) => {
    console.log('Received status update:', statuses);
    
    // Update all control items based on the received statuses
    Object.entries(statuses).forEach(([key, value]) => {
      const controlItem = document.querySelector(`.control-item[data-type="${key}"]`);
      if (controlItem) {
        // Update active state
        controlItem.classList.toggle('active', value === true);
        
        // Update the hidden checkbox if it exists
        const checkbox = controlItem.querySelector('.toggle-input');
        if (checkbox) {
          checkbox.checked = value;
        }

        // Update mode text if this is the spa toggle
        if (key === 'spa') {
          const spaText = document.querySelector('.spa-text');
          const poolText = document.querySelector('.pool-text');
          if (spaText && poolText) {
            spaText.classList.toggle('active-text', value === true);
            poolText.classList.toggle('active-text', value === false);
          }
        }
      }
    });

    // Handle filter-dependent disabled states
    const filterEnabled = statuses.filter === true;
    const modeControl = document.querySelector('.control-item[data-type="spa"]');
    if (modeControl) {
      modeControl.classList.toggle('disabled', !filterEnabled);
    }
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

  // Update the toggleHandler function
  function toggleHandler(event) {
    const toggle = event.target;
    const switchType = toggle.dataset.type;
    const newStatus = toggle.checked ? 'On' : 'Off';

    // If this is the mode toggle, handle spa/pool differently
    if (switchType === 'spa' || switchType === 'pool') {
      socket.emit('toggleSwitch', {
        switchType: 'spa',
        newStatus: toggle.checked ? 'On' : 'Off'
      });
      socket.emit('toggleSwitch', {
        switchType: 'pool',
        newStatus: toggle.checked ? 'Off' : 'On'
      });
    } else {
      socket.emit('toggleSwitch', {
        switchType,
        newStatus
      });
    }
  }

  // Handle the mode switch
  const modeSwitch = document.querySelector('.switch-handle');
  if (modeSwitch) {
    modeSwitch.addEventListener('click', function() {
      if (this.hasAttribute('disabled')) return;

      const isSpa = this.classList.contains('spa');
      this.classList.toggle('spa');
      this.classList.toggle('pool');
      
      // Update labels
      const spaLabel = document.querySelector('.mode-label.spa');
      const poolLabel = document.querySelector('.mode-label.pool');
      spaLabel.classList.toggle('active');
      poolLabel.classList.toggle('active');

      // Update ARIA state
      this.setAttribute('aria-checked', !isSpa);

      // Emit the appropriate events
      socket.emit('toggleSwitch', {
        switchType: 'spa',
        newStatus: !isSpa ? 'On' : 'Off'
      });
      socket.emit('toggleSwitch', {
        switchType: 'pool',
        newStatus: !isSpa ? 'Off' : 'On'
      });
    });
  }

  // Add to your DOMContentLoaded event handler
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
});