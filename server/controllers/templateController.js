/**
 * Quiz Template Controller
 * Admin creates quiz templates, students join via code
 */
const QuizTemplate = require('../models/QuizTemplate');
const Question = require('../models/Question');

/**
 * Create a new quiz template (Admin)
 * POST /admin/quiz-templates
 */
exports.createTemplate = async (req, res) => {
  try {
    const { title, questionCount = 10, timePerQuestion = 30, difficulty = 'mixed', category = 'all', maxAttempts = 1, startsAt, endsAt } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Quiz title is required' });
    }

    // Check available questions
    const filter = { tenantId: req.tenantId };
    if (difficulty !== 'mixed') filter.difficulty = difficulty;
    if (category && category !== 'all') filter.category = category;
    const available = await Question.countDocuments(filter);

    if (available === 0) {
      return res.status(400).json({ success: false, error: 'No questions available for selected criteria. Upload questions first.' });
    }

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = QuizTemplate.generateCode();
      const existing = await QuizTemplate.findOne({ code });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const template = await QuizTemplate.create({
      tenantId: req.tenantId,
      title,
      code,
      createdBy: req.admin._id,
      questionCount: Math.min(parseInt(questionCount), available),
      timePerQuestion: parseInt(timePerQuestion),
      difficulty,
      category,
      maxAttempts: parseInt(maxAttempts),
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    });

    res.status(201).json({
      success: true,
      template: {
        _id: template._id,
        id: template._id,
        title: template.title,
        code: template.code,
        questionCount: template.questionCount,
        timePerQuestion: template.timePerQuestion,
        difficulty: template.difficulty,
        category: template.category,
        maxAttempts: template.maxAttempts,
        isActive: template.isActive,
        availableQuestions: available,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * List all quiz templates (Admin)
 * GET /admin/quiz-templates
 */
exports.listTemplates = async (req, res) => {
  try {
    const templates = await QuizTemplate.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Toggle quiz template active status (Admin)
 * PATCH /admin/quiz-templates/:id/toggle
 */
exports.toggleTemplate = async (req, res) => {
  try {
    const template = await QuizTemplate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    template.isActive = !template.isActive;
    await template.save();

    res.json({ success: true, isActive: template.isActive });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Update quiz template (Admin)
 * PUT /admin/quiz-templates/:id
 */
exports.updateTemplate = async (req, res) => {
  try {
    const template = await QuizTemplate.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    const { title, questionCount, timePerQuestion, difficulty, category, maxAttempts, startsAt, endsAt } = req.body;

    if (title !== undefined) template.title = title.trim();
    if (questionCount !== undefined) template.questionCount = parseInt(questionCount);
    if (timePerQuestion !== undefined) template.timePerQuestion = parseInt(timePerQuestion);
    if (difficulty !== undefined) template.difficulty = difficulty;
    if (category !== undefined) template.category = category;
    if (maxAttempts !== undefined) template.maxAttempts = parseInt(maxAttempts);
    template.startsAt = startsAt || null;
    template.endsAt = endsAt || null;

    await template.save();

    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * Delete quiz template (Admin)
 * DELETE /admin/quiz-templates/:id?mode=quiz-only|full
 *   mode=quiz-only  → deletes only this template + its quiz sessions + attempts for this quiz
 *   mode=full       → deletes template + ALL questions + ALL attempts + ALL quiz sessions + ALL upload jobs
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const { mode = 'quiz-only' } = req.query;
    const tenantId = req.tenantId;

    const template = await QuizTemplate.findOne({ _id: req.params.id, tenantId });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });

    const Quiz    = require('../models/Quiz');
    const Attempt = require('../models/Attempt');

    if (mode === 'full') {
      // Cascade: wipe everything for this tenant
      const UploadJob = require('../models/UploadJob');
      const [, , qRes, aRes, jobRes] = await Promise.all([
        QuizTemplate.deleteMany({ tenantId }),
        Quiz.deleteMany({ tenantId }),
        Question.deleteMany({ tenantId }),
        Attempt.deleteMany({ tenantId }),
        UploadJob.deleteMany({ tenantId }),
      ]);
      return res.json({
        success: true,
        mode: 'full',
        deleted: {
          quizTemplates: 'all',
          questions: qRes.deletedCount,
          attempts: aRes.deletedCount,
          uploadJobs: jobRes.deletedCount,
        },
      });
    }

    // Default: quiz-only — delete just this template + its sessions/attempts
    const quizSessions = await Quiz.find({ tenantId, quizCode: template.code }).select('_id');
    const quizIds = quizSessions.map(q => q._id);

    const [, aRes, sRes] = await Promise.all([
      template.deleteOne(),
      Attempt.deleteMany({ tenantId, quizId: { $in: quizIds } }),
      Quiz.deleteMany({ tenantId, quizCode: template.code }),
    ]);

    res.json({
      success: true,
      mode: 'quiz-only',
      deleted: {
        quizTemplates: 1,
        attempts: aRes.deletedCount,
        quizSessions: sRes.deletedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Join a quiz via code (Student — public)
 * POST /quiz/join
 */
exports.joinByCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Quiz code is required' });
    }

    const template = await QuizTemplate.findOne({ code: code.toUpperCase(), isActive: true });
    if (!template) {
      return res.status(404).json({ success: false, error: 'Invalid quiz code or quiz is no longer active' });
    }

    // Check schedule
    const now = new Date();
    if (template.startsAt && now < template.startsAt) {
      return res.status(400).json({ success: false, error: `This quiz hasn't started yet. It starts at ${template.startsAt.toLocaleString()}` });
    }
    if (template.endsAt && now > template.endsAt) {
      return res.status(400).json({ success: false, error: 'This quiz has ended' });
    }

    res.json({
      success: true,
      quiz: {
        title: template.title,
        code: template.code,
        questionCount: template.questionCount,
        timePerQuestion: template.timePerQuestion,
        difficulty: template.difficulty,
        category: template.category,
        maxAttempts: template.maxAttempts,
        totalAttempts: template.totalAttempts || 0,
        tenantId: template.tenantId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
