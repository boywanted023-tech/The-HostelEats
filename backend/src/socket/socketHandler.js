const { Server } = require('socket.io');
const authService = require('../services/authService');
const AuditLog = require('../models/AuditLog');
const { getClientIp, generateDeviceFingerprint } = require('../utils/helpers');

const logConnection = (event, userId, ip, extra = {}) =>
  AuditLog.log({ action: `SOCKET_${event}`, userId, resource: 'socket', ip, details: extra }).catch(() => {});

const initializeSocket = (httpServer, redisClient) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 30000,
    pingInterval: 25000
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = authService.verifyToken(token, 'access');
      if (!decoded) return next(new Error('Invalid token'));

      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Auth error'));
    }
  });

  io.on('connection', (socket) => {
    const ip = socket.handshake.address || 'unknown';
    const userId = socket.userId;
    const role = socket.userRole;
    const fp = socket.handshake.headers['x-device-fingerprint'] || '';

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`user:${userId}`);
    socket.join(`${role}:${userId}`);

    if (role === 'customer') socket.join(`customer:${userId}`);
    else if (role === 'vendor') socket.join(`vendor:${userId}`);
    else if (role === 'delivery') socket.join(`delivery:${userId}`);
    else if (role === 'admin') socket.join('admin');

    logConnection('CONNECT', userId, ip, { role, fingerprint: fp });
    socket.emit('connected', { userId, role });

    socket.on('joinOrder', (orderId) => {
      if (orderId && /^[a-zA-Z0-9-]{1,40}$/.test(orderId)) {
        socket.join(`order:${orderId}`);
      }
    });

    socket.on('leaveOrder', (orderId) => {
      if (orderId) socket.leave(`order:${orderId}`);
    });

    socket.on('location:update', async (data) => {
      if (role !== 'delivery' || !data) return;
      socket.broadcast.to(`customer:${data.customerId}`).emit('delivery:location', {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date()
      });
    });

    socket.on('disconnect', (reason) => {
      logConnection('DISCONNECT', userId, ip, { reason });
    });
  });

  io.on('error', (err) => {
    console.error('Socket.IO error:', err.message);
  });

  console.log('Socket.IO initialized');
  return io;
};

module.exports = { initializeSocket };