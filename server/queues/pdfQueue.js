/**
 * PDF Processing Queue (BullMQ)
 *
 * The Queue is used by the API process to ENQUEUE jobs.
 * The Worker (workers/pdfWorker.js) runs separately to PROCESS them.
 *
 * Queue name: 'pdf-processing'
 * Job name:   'parse-pdf'
 * Job data:   { filePath, tenantId, jobId (UploadJob._id) }
 */
const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const Redis = require('ioredis');

let pdfQueue = null;
let redisClient = null;   // Separate ping-only client to check liveness

/**
 * Check whether Redis is actually reachable.
 * BullMQ's queue.add() buffers locally and doesn't throw when Redis is down,
 * so we need an explicit PING to detect availability before trusting the queue.
 *
 * Returns true if Redis responds, false otherwise.
 */
async function isRedisAvailable() {
  if (!redisClient) {
    const { connection } = getRedisConnection();
    redisClient = new Redis({
      ...connection,
      // Short timeouts so the check fails fast
      connectTimeout: 1500,
      commandTimeout: 1500,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    });

    redisClient.on('error', () => {}); // suppress unhandled error events
  }

  try {
    await redisClient.connect().catch(() => {}); // connect if not already
    const pong = await redisClient.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Returns a singleton Queue instance.
 * Safe to call multiple times — only one connection is created.
 */
function getPdfQueue() {
  if (!pdfQueue) {
    const { connection } = getRedisConnection();
    pdfQueue = new Queue('pdf-processing', {
      connection,
      defaultJobOptions: {
        attempts: 3,                              // retry failed jobs up to 3 times
        backoff: { type: 'exponential', delay: 5000 }, // 5s, 10s, 20s
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 20 },
      },
    });

    pdfQueue.on('error', (err) => {
      // Suppress noisy ECONNREFUSED noise — isRedisAvailable() handles detection
      if (err.code !== 'ECONNREFUSED') {
        console.error('[PdfQueue] Queue error:', err.message);
      }
    });
  }
  return pdfQueue;
}

module.exports = { getPdfQueue, isRedisAvailable };
