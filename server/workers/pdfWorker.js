/**
 * PDF Worker — runs as a SEPARATE process from the API server.
 *
 * Start with:  node workers/pdfWorker.js
 * Or via npm:  npm run worker
 *
 * Delete order (production-safe):
 *   1. Parse PDF  →  2. Validate  →  3. Save to DB  →  4. Delete file
 *   On failure: keep file in dev, delete in prod
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Worker } = require('bullmq');
const mongoose = require('mongoose');

const { getRedisConnection } = require('../config/redis');
const { parsePDF } = require('../utils/pdfParser');
const { cleanupAfterProcess, cleanupOrphanFiles } = require('../utils/fileCleanup');
const UploadJob = require('../models/UploadJob');

// ── Connect to MongoDB ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('[PdfWorker] MongoDB connected');
    // Remove any orphaned temp files left by a previous crash
    await cleanupOrphanFiles();
  })
  .catch(err => {
    console.error('[PdfWorker] MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ── Worker ─────────────────────────────────────────────────────────────────
const { connection } = getRedisConnection();

const worker = new Worker(
  'pdf-processing',

  async (job) => {
    const { filePath, tenantId, jobId } = job.data;
    console.log(`[PdfWorker] Processing job ${job.id} | UploadJob: ${jobId} | Tenant: ${tenantId}`);

    let parseSucceeded = false;

    try {
      // Step 1 — mark as processing
      await UploadJob.findByIdAndUpdate(jobId, { status: 'processing', progress: 10 });
      await job.updateProgress(10);

      // Step 2 — parse + validate (filterAndEnrich runs inside parsePDF)
      // parsePDF now returns { questions, rawText }
      const { questions: extractedQuestions, rawText } = await parsePDF(filePath);

      await UploadJob.findByIdAndUpdate(jobId, { progress: 70 });
      await job.updateProgress(70);

      // Step 3 — handle no valid questions (before touching the file)
      if (!extractedQuestions || extractedQuestions.length === 0) {
        await UploadJob.findByIdAndUpdate(jobId, {
          status: 'failed',
          error: 'No valid questions could be extracted. Check PDF format or question structure.',
          rawText,  // store even on failure — helps admin debug the PDF
          progress: 100,
          completedAt: new Date(),
        });
        // File has no useful content — clean up regardless of env
        await cleanupAfterProcess(filePath, true, `[job ${job.id}] empty result`);
        throw new Error('No valid questions extracted');
      }

      // Step 4 — tag with tenant + source
      const questions = extractedQuestions.map(q => ({
        ...q,
        tenantId,
        source: 'pdf',
      }));

      const needsReviewCount  = questions.filter(q => q.needsReview).length;
      const lowConfidenceCount = questions.filter(q => q.confidence < 0.7).length;

      // Step 5 — save to DB (UploadJob for admin review)
      await UploadJob.findByIdAndUpdate(jobId, {
        status: 'completed',
        progress: 100,
        extractedCount: questions.length,
        needsReviewCount,
        lowConfidenceCount,
        questions,
        rawText,   // ✅ lightweight audit trail — no cloud storage needed
        completedAt: new Date(),
      });

      parseSucceeded = true;  // ✅ DB save confirmed

      await job.updateProgress(100);

      console.log(
        `[PdfWorker] ✅ Job ${job.id} done — ${questions.length} valid questions ` +
        `(${needsReviewCount} need review, ${lowConfidenceCount} low confidence)`
      );

      return { jobId, questionsExtracted: questions.length, needsReviewCount };

    } finally {
      // ✅ Delete file ONLY after DB save confirmed — never before
      // In dev: keeps file on failure so devs can inspect it
      await cleanupAfterProcess(filePath, parseSucceeded, `[job ${job.id}]`);
    }
  },

  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 30_000 },
  }
);

// ── Event Handlers ─────────────────────────────────────────────────────────
worker.on('completed', (job, result) => {
  console.log(
    `[PdfWorker] ✅ Job ${job.id} completed: ${result.questionsExtracted} questions ` +
    `(${result.needsReviewCount} flagged for review)`
  );
});

worker.on('failed', async (job, err) => {
  console.error(`[PdfWorker] ❌ Job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);

  // Mark UploadJob failed on final retry
  if (job && job.attemptsMade >= (job.opts?.attempts || 3)) {
    const jobId = job.data?.jobId;
    if (jobId) {
      await UploadJob.findByIdAndUpdate(jobId, {
        status: 'failed',
        error: err.message,
        progress: 100,
        completedAt: new Date(),
      }).catch(() => {});
    }
    // Final retry exhausted — clean up regardless
    const filePath = job.data?.filePath;
    if (filePath) {
      await cleanupAfterProcess(filePath, false, `[job ${job.id}] final retry`).catch(() => {});
    }
  }
});

worker.on('error', (err) => {
  console.error('[PdfWorker] Worker error:', err.message);
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`[PdfWorker] ${signal} received — shutting down gracefully...`);
  await worker.close();
  await mongoose.connection.close();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

console.log('[PdfWorker] 🚀 Worker started — listening for PDF jobs...');
