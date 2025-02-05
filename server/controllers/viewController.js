const express = require('express');
const router = express.Router();
const poolConfig = require('../../config/poolConfig');

// Add session handling
router.use((req, res, next) => {
  if (req.session && req.session.authenticated) {
    next();
  } else if (req.path === '/login') {
    next();
  } else {
    res.redirect('/login');
  }
});

// Add login route
router.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.redirect('/');
  } else {
    res.render('login');
  }
});

router.post('/login', (req, res) => {
  const { pin } = req.body;
  if (pin === '0288') {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Update the main route to use serialHandler
router.get('/', (req, res) => {
  const serialHandler = req.serialHandler;
  const switchStatuses = {};
  
  if (serialHandler && serialHandler.currentStatuses) {
    for (const [key, value] of Object.entries(serialHandler.currentStatuses)) {
      if (poolConfig.usedSwitches.includes(key)) {
        switchStatuses[key] = value ? 'On' : 'Off';
      }
    }
  } else {
    // Fallback default values
    switchStatuses = {
      spa: 'Off',
      pool: 'Off',
      filter: 'Off',
      lights: 'Off',
      cleaner: 'Off',
      waterfall: 'Off'
    };
  }

  res.render('index', { 
    switchStatuses,
    currentLEDDisplay: serialHandler?.commandHandler?.currentLEDDisplay || { display: '' }
  });
});

module.exports = router;