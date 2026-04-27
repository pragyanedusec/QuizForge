/**
 * Quiz Controller (Upgraded)
 * - Server-authoritative session with expiresAt
 * - Anti-cheat: validates timer server-side
 * - No repeated questions per session
 * - Proper session lifecycle management
 */
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const { shuffleArray } = require('../utils/shuffle');

/**
 * Start a new quiz — creates session with server-controlled expiry
 * POST /quiz/start
 */
exports.startQuiz = async (req, res) => {
  try {
    const {
      userId = 'anon_' + Date.now(),
      userName = 'Anonymous',
      count = 10,
      difficulty = 'mixed',
      category = 'all',
      timePerQuestion = 30,
      quizCode = null,  // passed when student joins via template code
    } = req.body;

    const tenantId = req.tenantId;

    // Build match filter
    const matchFilter = { tenantId };
    if (difficulty !== 'mixed') matchFilter.difficulty = difficulty;
    if (category && category !== 'all') matchFilter.category = category;

    // Check available questions
    const available = await Question.countDocuments(matchFilter);
    const questionCount = Math.min(parseInt(count), available);

    if (questionCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No questions available for the selected criteria',
      });
    }

    // Use MongoDB $sample for true random selection
    const randomQuestions = await Question.aggregate([
      { $match: matchFilter },
      { $sample: { size: questionCount } },
    ]);

    // Shuffle options for each question (tenant setting)
    const shouldShuffle = req.tenant.settings.shuffleOptions !== false;
    const quizQuestions = randomQuestions.map(q => {
      const options = shouldShuffle ? shuffleArray(q.options) : q.options;
      return {
        questionId: q._id,
        question: q.question,
        options,
        correctAnswer: q.correctAnswer,
      };
    });

    // Per-question timing — total = timePerQuestion × questionCount
    const now = new Date();
    const timePerQ = parseInt(timePerQuestion);
    const totalTimeLimit = timePerQ * questionCount;
    const expiresAt = new Date(now.getTime() + totalTimeLimit * 1000);

    // ── Anti-cheat: expire any previous in-progress session for this user+code ──
    // Only enforced when tenant has antiCheat enabled (default: true)
    if (quizCode && req.tenant?.settings?.antiCheat !== false) {
      await Quiz.updateMany(
        { tenantId, userName, quizCode, status: 'in-progress' },
        { $set: { status: 'expired' } }
      );
    }

    // Create quiz session
    const quiz = await Quiz.create({
      tenantId,
      userId,
      userName,
      questions: quizQuestions,
      totalQuestions: questionCount,
      timeLimit: totalTimeLimit,
      timePerQuestion: timePerQ,
      difficulty,
      category: category || 'General',
      status: 'in-progress',
      startedAt: now,
      expiresAt,
      quizCode: quizCode || null,
    });

    // Return questions WITHOUT correct answers
    const clientQuestions = quizQuestions.map(q => ({
      questionId: q.questionId,
      question: q.question,
      options: q.options,
    }));

    res.json({
      success: true,
      quiz: {
        quizId: quiz._id,
        questions: clientQuestions,
        totalQuestions: questionCount,
        timePerQuestion: timePerQ,
        timeLimit: totalTimeLimit,
        startedAt: quiz.startedAt,
        expiresAt: quiz.expiresAt,
      },
    });
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Submit quiz answers — validates session and grades
 * POST /quiz/submit
 */
exports.submitQuiz = async (req, res) => {
  try {
    const { quizId, answers, userName, userId } = req.body;

    if (!quizId) {
      return res.status(400).json({ success: false, error: 'Quiz ID is required' });
    }

    const quiz = await Quiz.findOne({ _id: quizId, tenantId: req.tenantId });
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz session not found' });
    }

    // ── Hard status lock — reject if already completed or expired ────────────
    if (quiz.status !== 'in-progress') {
      return res.status(409).json({
        success: false,
        error: quiz.status === 'completed'
          ? 'This quiz has already been submitted.'
          : 'This quiz session has expired.',
        status: quiz.status,
      });
    }

    // Server-authoritative time check
    const now = new Date();
    const isExpired = quiz.isExpired();
    const elapsed = (now - quiz.startedAt) / 1000;

    // Grace period: 10 seconds past expiry for network latency
    const hardExpired = elapsed > quiz.timeLimit + 10;

    // Grade answers
    let score = 0;
    const gradedAnswers = quiz.questions.map(q => {
      const userAnswer = answers?.find(a => a.questionId === q.questionId.toString());
      const isCorrect = userAnswer?.selectedAnswer === q.correctAnswer;
      if (isCorrect) score++;

      return {
        questionId: q.questionId,
        selectedAnswer: userAnswer?.selectedAnswer || null,
        isCorrect,
        correctAnswer: q.correctAnswer,
        question: q.question,
        options: q.options,
      };
    });

    const percentage = Math.round((score / quiz.totalQuestions) * 100);
    const timeTaken = Math.min(Math.round(elapsed), quiz.timeLimit);

    // Save attempt
    const attempt = await Attempt.create({
      quizId: quiz._id,
      tenantId: req.tenantId,
      userId: userId || quiz.userId,
      userName: userName || quiz.userName,
      answers: gradedAnswers,
      score,
      totalQuestions: quiz.totalQuestions,
      percentage,
      timeTaken,
      startTime: quiz.startedAt,
      submissionTime: now,
      status: hardExpired ? 'timed-out' : 'submitted',
    });

    // Update quiz session
    quiz.status = isExpired ? 'expired' : 'completed';
    await quiz.save();

    res.json({
      success: true,
      result: {
        attemptId: attempt._id,
        score,
        totalQuestions: quiz.totalQuestions,
        percentage,
        timeTaken,
        answers: gradedAnswers,
        status: attempt.status,
      },
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get session status — for resume capability
 * GET /quiz/session/:id
 */
exports.getSession = async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Check if expired server-side
    if (quiz.status === 'in-progress' && quiz.isExpired()) {
      quiz.status = 'expired';
      await quiz.save();
    }

    res.json({
      success: true,
      session: {
        quizId: quiz._id,
        status: quiz.status,
        remainingTime: quiz.getRemainingTime(),
        totalQuestions: quiz.totalQuestions,
        expiresAt: quiz.expiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get quiz result
 * GET /quiz/result/:id
 */
exports.getResult = async (req, res) => {
  try {
    const attempt = await Attempt.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!attempt) {
      return res.status(404).json({ success: false, error: 'Result not found' });
    }
    res.json({ success: true, result: attempt });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get leaderboard
 * GET /quiz/leaderboard
 */
exports.getLeaderboard = async (req, res) => {
  try {
    // Check if leaderboard is enabled for this tenant
    if (!req.tenant.settings.leaderboardEnabled) {
      return res.json({ success: true, leaderboard: [], disabled: true });
    }

    const { limit = 20 } = req.query;
    const leaderboard = await Attempt.find({ tenantId: req.tenantId })
      .sort({ percentage: -1, timeTaken: 1 })
      .limit(parseInt(limit))
      .select('userName score totalQuestions percentage timeTaken submissionTime');

    res.json({ success: true, leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get quiz config
 * GET /quiz/config
 */
exports.getQuizConfig = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [totalQuestions, categories, difficultyCounts] = await Promise.all([
      Question.countDocuments({ tenantId }),
      Question.distinct('category', { tenantId }),
      Question.aggregate([
        { $match: { tenantId } },
        { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      config: {
        totalQuestions,
        categories: ['all', ...categories],
        difficulties: ['mixed', 'easy', 'medium', 'hard'],
        difficultyCounts,
        defaultTimePerQuestion: req.tenant.settings.defaultTimePerQuestion || 30,
        defaultQuestionCount: Math.min(req.tenant.settings.defaultQuestionCount, totalQuestions),
        maxQuestionCount: totalQuestions,
        timerEnabled: req.tenant.settings.timerEnabled,
        leaderboardEnabled: req.tenant.settings.leaderboardEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
