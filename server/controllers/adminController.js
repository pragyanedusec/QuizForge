/**
 * Admin Controller (Upgraded)
 * - Async PDF processing via BullMQ queue (Redis-backed)
 * - Graceful fallback to in-process if Redis unavailable
 * - Question CRUD with source/tags
 * - Admin dashboard stats
 */
const Question = require('../models/Question');
const UploadJob = require('../models/UploadJob');
const { parsePDF } = require('../utils/pdfParser');

/**
 * Upload PDF — enqueues BullMQ job, returns jobId immediately.
 * Falls back to in-process parsing if Redis is unavailable.
 * POST /admin/upload-pdf
 */
exports.uploadPDF = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }

    // Create UploadJob record — this is the status tracker the frontend polls
    const uploadJob = await UploadJob.create({
      tenantId: req.tenantId,
      fileName: req.file.originalname,
      status: 'pending',
      progress: 0,
    });

    // Return immediately — processing is async
    res.json({
      success: true,
      message: 'PDF upload received — processing in background',
      jobId: uploadJob._id,
    });

    // Check Redis availability with a live PING before trusting BullMQ.
    // BullMQ's queue.add() buffers locally and does NOT throw when Redis is down,
    // so we must explicitly verify before assuming the job will run.
    const { getPdfQueue, isRedisAvailable } = require('../queues/pdfQueue');
    const redisReady = await isRedisAvailable();

    if (redisReady) {
      try {
        const queue = getPdfQueue();
        await queue.add('parse-pdf', {
          filePath: req.file.path,
          tenantId: req.tenantId,
          jobId: uploadJob._id.toString(),
        });
        console.log(`[uploadPDF] Enqueued BullMQ job for UploadJob ${uploadJob._id}`);
        return; // worker will handle the rest
      } catch (queueErr) {
        console.warn('[uploadPDF] Failed to enqueue despite Redis ping:', queueErr.message);
      }
    } else {
      console.warn('[uploadPDF] Redis unavailable — running in-process fallback');
    }

    // Fallback: run in-process synchronously (blocks this async task, not the HTTP response)
    processPDFInProcess(req.file.path, uploadJob._id, req.tenantId);

  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate PDF processing: ' + error.message });
  }

};

/**
 * In-process PDF fallback (used when Redis/BullMQ is unavailable).
 * Mirrors the worker's safe delete order:
 *   parse → validate → save to DB → THEN delete file
 */
async function processPDFInProcess(filePath, jobId, tenantId) {
  const { cleanupAfterProcess } = require('../utils/fileCleanup');
  let saveSucceeded = false;

  try {
    await UploadJob.findByIdAndUpdate(jobId, { status: 'processing', progress: 10 });

    // Step 1 — parse + validate (returns { questions, rawText })
    const { questions: extractedQuestions, rawText } = await parsePDF(filePath);

    await UploadJob.findByIdAndUpdate(jobId, { progress: 70 });

    // Step 2 — no valid questions
    if (!extractedQuestions || extractedQuestions.length === 0) {
      await UploadJob.findByIdAndUpdate(jobId, {
        status: 'failed',
        error: 'No questions could be extracted. Check PDF format.',
        rawText,
        progress: 100,
        completedAt: new Date(),
      });
      // Empty result — clean up unconditionally
      saveSucceeded = true;
      return;
    }

    const questions = extractedQuestions.map(q => ({ ...q, tenantId, source: 'pdf' }));
    const needsReviewCount   = questions.filter(q => q.needsReview).length;
    const lowConfidenceCount = questions.filter(q => q.confidence < 0.7).length;

    // Step 3 — save to DB first
    await UploadJob.findByIdAndUpdate(jobId, {
      status: 'completed',
      progress: 100,
      extractedCount: questions.length,
      needsReviewCount,
      lowConfidenceCount,
      questions,
      rawText,   // lightweight audit trail
      completedAt: new Date(),
    });

    saveSucceeded = true;   // ✅ confirmed before file deletion

  } catch (error) {
    console.error('[processPDFInProcess] Failed:', error);
    await UploadJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      error: error.message,
      progress: 100,
      completedAt: new Date(),
    }).catch(() => {});

  } finally {
    // ✅ Delete ONLY after DB save — keep file in dev on failure
    await cleanupAfterProcess(filePath, saveSucceeded, '[in-process]');
  }
}

/**
 * Get upload job status (polling endpoint)
 * GET /admin/upload-status/:jobId
 */
exports.getUploadStatus = async (req, res) => {
  try {
    const job = await UploadJob.findOne({ _id: req.params.jobId, tenantId: req.tenantId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    res.json({
      success: true,
      job: {
        id: job._id,
        status: job.status,
        progress: job.progress,
        fileName: job.fileName,
        extractedCount: job.extractedCount,
        questions: job.status === 'completed' ? job.questions : undefined,
        error: job.error,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Save reviewed questions to database
 * POST /admin/questions
 */
exports.saveQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'No questions provided' });
    }

    const questionsWithTenant = questions.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty || 'medium',
      category: q.category || 'General',
      tags: q.tags || [],
      source: q.source || 'manual',
      tenantId: req.tenantId,
      createdBy: req.admin?._id,
    }));

    const saved = await Question.insertMany(questionsWithTenant);

    res.status(201).json({
      success: true,
      message: `${saved.length} questions saved successfully`,
      count: saved.length,
    });
  } catch (error) {
    console.error('Save questions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get all questions for tenant
 * GET /admin/questions
 */
exports.getQuestions = async (req, res) => {
  try {
    const { difficulty, category, search, page = 1, limit = 50 } = req.query;
    const filter = { tenantId: req.tenantId };

    if (difficulty && difficulty !== 'all') filter.difficulty = difficulty;
    if (category && category !== 'all') filter.category = category;
    if (search) filter.question = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Question.countDocuments(filter),
    ]);

    const categories = await Question.distinct('category', { tenantId: req.tenantId });

    res.json({
      success: true,
      questions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      categories,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update a question
 * PUT /admin/questions/:id
 */
exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    res.json({ success: true, question });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete a question
 * DELETE /admin/questions/:id
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
    if (!question) {
      return res.status(404).json({ success: false, error: 'Question not found' });
    }
    res.json({ success: true, message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Delete ALL questions + related data for tenant (cascade delete)
 * DELETE /admin/questions
 */
exports.deleteAllQuestions = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const UploadJob    = require('../models/UploadJob');
    const QuizTemplate = require('../models/QuizTemplate');
    const Quiz         = require('../models/Quiz');
    const Attempt      = require('../models/Attempt');

    const [qResult, jobResult, templateResult, quizResult, attemptResult] = await Promise.all([
      Question.deleteMany({ tenantId }),
      UploadJob.deleteMany({ tenantId }),
      QuizTemplate.deleteMany({ tenantId }),
      Quiz.deleteMany({ tenantId }),
      Attempt.deleteMany({ tenantId }),
    ]);

    res.json({
      success: true,
      message: 'All data cleared successfully',
      deleted: {
        questions:     qResult.deletedCount,
        uploadJobs:    jobResult.deletedCount,
        quizTemplates: templateResult.deletedCount,
        quizzes:       quizResult.deletedCount,
        attempts:      attemptResult.deletedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Dashboard stats
 * GET /admin/stats
 */
exports.getStats = async (req, res) => {
  try {
    const Attempt = require('../models/Attempt');

    const [totalQuestions, difficultyStats, categoryStats, totalAttempts, recentAttempts] = await Promise.all([
      Question.countDocuments({ tenantId: req.tenantId }),
      Question.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]),
      Question.aggregate([
        { $match: { tenantId: req.tenantId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      Attempt.countDocuments({ tenantId: req.tenantId }),
      Attempt.find({ tenantId: req.tenantId })
        .sort({ submissionTime: -1 })
        .limit(10)
        .select('userName score totalQuestions percentage submissionTime timeTaken'),
    ]);

    // Per-template analytics — isolated so a pipeline error doesn't kill the whole response
    let templateAnalytics = [];
    try {
      const raw = await Attempt.aggregate([
        { $match: { tenantId: req.tenantId } },
        {
          $lookup: {
            from: 'quizzes',
            localField: 'quizId',
            foreignField: '_id',
            as: 'session',
          },
        },
        // preserveNullAndEmptyArrays: true keeps attempts that have no matching quiz
        { $unwind: { path: '$session', preserveNullAndEmptyArrays: true } },
        // Only group by quizCode when it's present
        { $match: { 'session.quizCode': { $ne: null } } },
        {
          $group: {
            _id: '$session.quizCode',
            attempts: { $sum: 1 },
            avgScore: { $avg: '$percentage' },
            topScore: { $max: '$percentage' },
            avgTime:  { $avg: '$timeTaken' },
          },
        },
        { $sort: { attempts: -1 } },
        { $limit: 10 },
      ]);
      templateAnalytics = raw.map(t => ({
        quizCode:   t._id,
        attempts:   t.attempts,
        avgScore:   Math.round(t.avgScore ?? 0),
        topScore:   Math.round(t.topScore ?? 0),
        avgTimeSec: Math.round(t.avgTime ?? 0),
      }));
    } catch (aggErr) {
      console.warn('[getStats] templateAnalytics aggregation failed:', aggErr.message);
    }

    res.json({
      success: true,
      stats: {
        totalQuestions,
        totalAttempts,
        difficultyBreakdown: difficultyStats,
        categoryBreakdown: categoryStats,
        recentAttempts,
        templateAnalytics,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


