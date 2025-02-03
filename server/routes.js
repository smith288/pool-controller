// server/routes.js

const express = require('express');
const apiController = require('./controllers/apiController');
const viewController = require('./controllers/viewController');

function createRouter(serialHandler) {
  const router = express.Router();

  // Pass serialHandler to controllers
  router.get('/', viewController.index(serialHandler));

  // API routes
  router.get('/api/status', apiController.getStatus(serialHandler));
  
  router.post('/api/switch/:type/:value', apiController.toggleSwitch(serialHandler));

  // Add more routes as needed

  return router;
}

module.exports = createRouter;
