const Redis = require('ioredis');

let redisClient = null;

const initializeRedis = () => {
  if (redisClient) return redisClient;

  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false
  });

  redisClient.on('connect', () => console.log('Redis connected'));
  redisClient.on('error', (err) => console.error('Redis error:', err.message));
  redisClient.on('close', () => console.warn('Redis connection closed'));

  return redisClient;
};

const getRedis = () => {
  if (!redisClient) return initializeRedis();
  return redisClient;
};

const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

module.exports = { initializeRedis, getRedis, closeRedis, redis: getRedis() };