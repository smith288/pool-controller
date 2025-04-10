// server/routes.js

const express = require('express');
const apiController = require('./controllers/apiController');
const viewController = require('./controllers/viewController');

function createRouter(serialHandler) {
  const router = express.Router();

  // Update viewController to include serialHandler data
  router.use((req, res, next) => {
    req.serialHandler = serialHandler;
    next();
  });

  // Use the viewController router
  router.use('/', viewController);

  // API routes
  router.get('/api/status', apiController.getStatus(serialHandler));
  
  router.get('/api/switch/:type/:value?', apiController.toggleSwitch(serialHandler));

  // Add more routes as needed

  return router;
}

module.exports = createRouter;
