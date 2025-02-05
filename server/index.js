// server/index.js

const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const createRouter = require('./routes');
const socketHandler = require('./socketHandler');
const session = require('express-session');

function createServer(serialHandler) {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  // Set up view engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

  // Middleware
  app.use(express.static(path.join(__dirname, '../public')));
  app.use(express.json());
  app.use(session({
    secret: 'pool-controller-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));

  // Routes
  app.use('/', createRouter(serialHandler));

  // Socket.io handling
  // io.on('connection', (socket) => {
  //   try {
  //     console.log('Client connected');
      
  //   socket.on('toggleSwitch', (data) => {
  //     serialHandler.toggleSwitch(data);
  //   });

  //   socket.on('directionPress', (data) => {
  //     serialHandler.sendCommand(data.direction);
  //   });

  //   socket.on('disconnect', () => {
  //     console.log('Client disconnected');
  //   });
  //   } catch (error) {
  //     console.error('Error in socket connection:', error);
  //   }
  // });

  // Set up Socket.IO handlers
  socketHandler(io, serialHandler);
  return server;
}

module.exports = createServer;
