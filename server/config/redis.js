/**
 * Redis connection config shared between Queue and Worker.
 * Uses ioredis under the hood (BullMQ's native connection type).
 *
 * Supports:
 *  - Local Redis (default)
 *  - Redis Cloud / Upstash via REDIS_URL (rediss:// for TLS)
 *  - Railway / Render managed Redis via individual env vars
 */

const getRedisConnection = () => {
  // Full URL takes priority (Upstash, Railway, Render)
  if (process.env.REDIS_URL) {
    const isTLS = process.env.REDIS_URL.startsWith('rediss://');
    return {
      connection: {
        url: process.env.REDIS_URL,
        ...(isTLS ? { tls: {} } : {}),
        maxRetriesPerRequest: null, // required by BullMQ
      },
    };
  }

  // Individual host/port env vars
  return {
    connection: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // required by BullMQ
    },
  };
};

module.exports = { getRedisConnection };
