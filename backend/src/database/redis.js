const redis = require('redis');
const { logger } = require('../utils/logger');

let client;

const connectRedis = async () => {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    client = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        lazyConnect: true
      }
    });

    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    client.on('ready', () => {
      logger.info('Redis client ready');
    });

    client.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await client.connect();
    
    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

const getClient = () => {
  if (!client) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return client;
};

const set = async (key, value, expireSeconds = null) => {
  try {
    const redisClient = getClient();
    if (expireSeconds) {
      await redisClient.setEx(key, expireSeconds, JSON.stringify(value));
    } else {
      await redisClient.set(key, JSON.stringify(value));
    }
    return true;
  } catch (error) {
    logger.error('Redis SET error:', error);
    return false;
  }
};

const get = async (key) => {
  try {
    const redisClient = getClient();
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null;
  }
};

const del = async (key) => {
  try {
    const redisClient = getClient();
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Redis DEL error:', error);
    return false;
  }
};

const exists = async (key) => {
  try {
    const redisClient = getClient();
    return await redisClient.exists(key);
  } catch (error) {
    logger.error('Redis EXISTS error:', error);
    return false;
  }
};

const expire = async (key, seconds) => {
  try {
    const redisClient = getClient();
    return await redisClient.expire(key, seconds);
  } catch (error) {
    logger.error('Redis EXPIRE error:', error);
    return false;
  }
};

const closeRedis = async () => {
  if (client) {
    await client.quit();
    logger.info('Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getClient,
  set,
  get,
  del,
  exists,
  expire,
  closeRedis
};
