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
const QuizTemplate = require('../models/QuizTemplate');
const { shuffleArray } = require('../utils/shuffle');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildResultPayload = (attempt, showCorrectAnswers) => {
  const source = attempt.toObject ? attempt.toObject() : attempt;
  const answers = (source.answers || []).map((answer) => ({
    questionId: answer.questionId,
    selectedAnswer: answer.selectedAnswer,
    isCorrect: answer.isCorrect,
    question: answer.question,
    options: answer.options,
    ...(showCorrectAnswers ? { correctAnswer: answer.correctAnswer } : {}),
  }));

  return {
    _id: source._id,
    attemptId: source._id,
    quizId: source.quizId,
    quizCode: source.quizCode,
    userId: source.userId,
    userName: source.userName,
    score: source.score,
    totalQuestions: source.totalQuestions,
    percentage: source.percentage,
    timeTaken: source.timeTaken,
    status: source.status,
    startTime: source.startTime,
    submissionTime: source.submissionTime,
    showCorrectAnswers,
    answers,
  };
};

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
    const normalizedUserName = userName.trim();
    let template = null;
    let resolvedCount = Number.isFinite(parseInt(count)) ? parseInt(count) : 10;
    let resolvedDifficulty = difficulty;
    let resolvedCategory = category;
    let resolvedTimePerQuestion = Number.isFinite(parseInt(timePerQuestion)) ? parseInt(timePerQuestion) : 30;

    if (!normalizedUserName) {
      return res.status(400).json({
        success: false,
        error: 'User name is required',
      });
    }

    if (quizCode) {
      template = await QuizTemplate.findOne({
        tenantId,
        code: quizCode.toUpperCase(),
        isActive: true,
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Quiz template not found or inactive',
        });
      }

      const now = new Date();
      if (template.startsAt && now < template.startsAt) {
        return res.status(400).json({
          success: false,
          error: `This quiz has not started yet. It starts at ${template.startsAt.toLocaleString()}.`,
        });
      }

      if (template.endsAt && now > template.endsAt) {
        return res.status(400).json({
          success: false,
          error: 'This quiz has ended',
        });
      }

      if (template.maxAttempts > 0) {
        const priorAttempts = await Attempt.countDocuments({
          tenantId,
          quizCode: template.code,
          userName: new RegExp(`^${escapeRegex(normalizedUserName)}$`, 'i'),
        });

        if (priorAttempts >= template.maxAttempts) {
          return res.status(403).json({
            success: false,
            error: `Attempt limit reached for this quiz (${template.maxAttempts} max).`,
          });
        }
      }

      resolvedCount = template.questionCount;
      resolvedDifficulty = template.difficulty;
      resolvedCategory = template.category;
      resolvedTimePerQuestion = template.timePerQuestion;
    }

    resolvedCount = Math.max(1, resolvedCount);
    resolvedTimePerQuestion = Math.max(1, resolvedTimePerQuestion);

    // Build match filter
    const matchFilter = { tenantId };
    if (resolvedDifficulty !== 'mixed') matchFilter.difficulty = resolvedDifficulty;
    if (resolvedCategory && resolvedCategory !== 'all') matchFilter.category = resolvedCategory;

    // Check available questions
    const available = await Question.countDocuments(matchFilter);
    const questionCount = Math.min(resolvedCount, available);

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
    const timePerQ = resolvedTimePerQuestion;
    const totalTimeLimit = timePerQ * questionCount;
    const expiresAt = new Date(now.getTime() + totalTimeLimit * 1000);

    // ── Anti-cheat: expire any previous in-progress session for this user+code ──
    // Only enforced when tenant has antiCheat enabled (default: true)
    if ((template?.code || quizCode) && req.tenant?.settings?.antiCheat !== false) {
      await Quiz.updateMany(
        { tenantId, userName, quizCode: template?.code || quizCode, status: 'in-progress' },
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
      difficulty: resolvedDifficulty,
      category: resolvedCategory || 'General',
      status: 'in-progress',
      startedAt: now,
      expiresAt,
      quizCode: template?.code || quizCode || null,
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
      quizCode: quiz.quizCode || null,
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

    if (quiz.quizCode) {
      await QuizTemplate.updateOne(
        { tenantId: req.tenantId, code: quiz.quizCode },
        { $inc: { totalAttempts: 1 } }
      ).catch(() => {});
    }

    const showCorrectAnswers = req.tenant?.settings?.showCorrectAnswers !== false;

    res.json({
      success: true,
      result: buildResultPayload(attempt, showCorrectAnswers),
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
    const showCorrectAnswers = req.tenant?.settings?.showCorrectAnswers !== false;
    res.json({ success: true, result: buildResultPayload(attempt, showCorrectAnswers) });
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

    const { limit = 20, quizCode } = req.query;
    const filter = { tenantId: req.tenantId };
    if (quizCode) filter.quizCode = quizCode.toUpperCase();

    const leaderboard = await Attempt.find(filter)
      .sort({ percentage: -1, timeTaken: 1 })
      .limit(parseInt(limit))
      .select('userName score totalQuestions percentage timeTaken submissionTime quizCode');

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
