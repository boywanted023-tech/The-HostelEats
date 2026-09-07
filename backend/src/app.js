require('dotenv').config();

const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const xss = require('xss-clean');
const hpp = require('hpp');

const { connectDB } = require('./config/database');
const { initializeRedis, closeRedis } = require('./config/redis');
const { initializeSocket } = require('./socket/socketHandler');
const { seedDatabase } = require('./utils/seedData');

const {
  requestId,
  securityHeaders,
  corsConfig,
  rateLimiter,
  checkBlacklist,
  detectSuspicious
} = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes      = require('./routes/auth');
const customerRoutes  = require('./routes/customer');
const vendorRoutes    = require('./routes/vendor');
const deliveryRoutes  = require('./routes/delivery');
const adminRoutes     = require('./routes/admin');

const app = express();
const server = http.createServer(app);

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(xss());
app.use(hpp());

app.use(requestId);
app.use(securityHeaders);
app.use(corsConfig);
app.use(checkBlacklist);
app.use(detectSuspicious);
app.use(rateLimiter);

app.get('/health', (req, res) => res.json({
  status: 'OK',
  service: 'HostelEats API',
  timestamp: new Date().toISOString(),
  uptime: process.uptime()
}));

app.use('/api/auth',     authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/vendor',   vendorRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin',    adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    initializeRedis();
    const io = initializeSocket();
    app.set('io', io);

    if (process.env.SEED_DB !== 'false') {
      await seedDatabase();
    }

    const PORT = parseInt(process.env.PORT, 10) || 5000;
    server.listen(PORT, () => {
      console.log(`HostelEats API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    try {
      await closeRedis();
      require('mongoose').connection.close();
      console.log('Server closed');
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

startServer();

module.exports = { app, server };