// server/index.js

const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const routes = require('./routes');
const socketHandler = require('./socketHandler');

function createServer(serialHandler) {
  // Create Express app
  const app = express();

  var publicPath = path.join(__dirname, '..', 'public');
  var viewPath = path.join(__dirname, '..', 'views');

  console.log(`Public path: ${publicPath}`);
  console.log(`View path: ${viewPath}`);

  // Set EJS as templating engine
  app.set('view engine', 'ejs');
  app.set('views', viewPath);

  // Serve static assets
  app.use(express.static(publicPath));

  // Parse JSON bodies
  app.use(express.json());

  // Make session available in EJS templates
  app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
  });

  // Use routes
  app.use('/', routes(serialHandler));

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.IO
  const io = socketIo(server);

  // Set up Socket.IO handlers
  socketHandler(io, serialHandler);

  return server;
}


module.exports = createServer;
