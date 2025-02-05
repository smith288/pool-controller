// server/index.js

const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const createRouter = require('./routes');
const socketHandler = require('./socketHandler');
const session = require('express-session');
const poolConfig = require('../config/poolConfig');

function createServer(serialHandler) {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  // Set up view engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));
  
  // Add base path to locals so it's available in all views
  app.locals.basePath = poolConfig.basePath;

  // Serve static files under the base path
  app.use(poolConfig.basePath, express.static(path.join(__dirname, '../public')));
  app.use(`${poolConfig.basePath}/fonts`, express.static(path.join(__dirname, '../public/fonts')));
  
  // Then add other middleware
  app.use(express.json());
  app.use(session({
    secret: 'pool-controller-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));

  // Add authentication check after static files
  app.use((req, res, next) => {
    // Skip auth check for static files and login
    if (req.path.startsWith('/css/') || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/fonts/') ||
        req.path.startsWith('/socket.io/') ||
        req.path === '/login') {
      return next();
    }

    if (req.session && req.session.authenticated) {
      next();
    } else {
      res.redirect('/login');
    }
  });

  // Mount all routes under the base path
  app.use(poolConfig.basePath, createRouter(serialHandler));

  // Set up Socket.IO with the base path
  io.path(`${poolConfig.basePath}/socket.io`);
  socketHandler(io, serialHandler);
  
  return server;
}

module.exports = createServer;
