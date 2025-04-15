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
  app.locals.basePath = '/' + poolConfig.basePath;

  // Normalize base path for middleware
  const normalizedBasePath = poolConfig.basePath ? '/' + poolConfig.basePath : '';

  // Serve static files under the base path
  app.use(normalizedBasePath, express.static(path.join(__dirname, '../public')));
  app.use(`${normalizedBasePath}/fonts`, express.static(path.join(__dirname, '../public/fonts')));
  
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
    // Remove multiple consecutive slashes from path
    req.url = req.url.replace(/\/{2,}/g, '/');
    
    console.log("Request path: ", req.path);
    // Skip auth check for static files and login
    if (req.path.startsWith('/css/') || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/fonts/') ||
        req.path.startsWith('/socket.io/') ||
        req.path.indexOf('/login') > -1) {
      return next();
    }

    if ((req.session && req.session.authenticated) || !poolConfig.usePin) {
      next();
    } else {
      console.log("Config: ", JSON.stringify(poolConfig, null, 2));
      // Construct login path using normalized base path
      const loginPath = `${normalizedBasePath}/login`;
      console.log(`Redirecting to ${loginPath}`);
      res.redirect(loginPath);
    }
  });

  // Mount all routes under the base path
  app.use(normalizedBasePath, createRouter(serialHandler));

  // Set up Socket.IO with the base path
  io.path(`${normalizedBasePath}/socket.io`);
  socketHandler(io, serialHandler);
  
  return server;
}

module.exports = createServer;
