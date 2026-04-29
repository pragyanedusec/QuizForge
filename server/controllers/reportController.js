/**
 * Report Controller
 * Generates detailed quiz attempt reports for the admin panel
 */
const Attempt = require('../models/Attempt');
const QuizTemplate = require('../models/QuizTemplate');

/**
 * List all quiz templates with attempt summary
 * GET /admin/reports/quizzes
 */
exports.listQuizReports = async (req, res) => {
  try {
    const templates = await QuizTemplate.find({ tenantId: req.tenantId })
      .sort({ createdAt: -1 })
      .lean();

    const quizSummaries = await Promise.all(
      templates.map(async (t) => {
        const attempts = await Attempt.find({ tenantId: req.tenantId, quizCode: t.code }).lean();
        const totalStudents = attempts.length;
        const avgScore = totalStudents > 0
          ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / totalStudents)
          : 0;
        const highestScore = totalStudents > 0
          ? Math.max(...attempts.map(a => a.percentage))
          : 0;
        const lowestScore = totalStudents > 0
          ? Math.min(...attempts.map(a => a.percentage))
          : 0;

        return {
          _id: t._id,
          title: t.title,
          code: t.code,
          questionCount: t.questionCount,
          timePerQuestion: t.timePerQuestion,
          difficulty: t.difficulty,
          category: t.category,
          isActive: t.isActive,
          createdAt: t.createdAt,
          totalStudents,
          avgScore,
          highestScore,
          lowestScore,
        };
      })
    );

    res.json({ success: true, quizzes: quizSummaries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get detailed report for a specific quiz (all attempts + per-question analysis)
 * GET /admin/reports/quizzes/:code
 */
exports.getQuizReport = async (req, res) => {
  try {
    const { code } = req.params;

    const template = await QuizTemplate.findOne({
      tenantId: req.tenantId,
      code: code.toUpperCase(),
    }).lean();

    if (!template) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    const attempts = await Attempt.find({
      tenantId: req.tenantId,
      quizCode: template.code,
    })
      .sort({ submissionTime: -1 })
      .lean();

    // Per-question analysis
    const questionStats = {};
    attempts.forEach((attempt) => {
      (attempt.answers || []).forEach((answer) => {
        const qId = answer.questionId?.toString() || answer.question;
        if (!questionStats[qId]) {
          questionStats[qId] = {
            question: answer.question,
            options: answer.options,
            correctAnswer: answer.correctAnswer,
            totalAnswered: 0,
            correctCount: 0,
          };
        }
        questionStats[qId].totalAnswered++;
        if (answer.isCorrect) questionStats[qId].correctCount++;
      });
    });

    const questionAnalysis = Object.values(questionStats).map((q) => ({
      ...q,
      accuracy: q.totalAnswered > 0
        ? Math.round((q.correctCount / q.totalAnswered) * 100)
        : 0,
    }));

    // Student-level details
    const students = attempts.map((a) => ({
      _id: a._id,
      userName: a.userName,
      userId: a.userId,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      timeTaken: a.timeTaken,
      status: a.status,
      submissionTime: a.submissionTime,
      answers: (a.answers || []).map((ans) => ({
        question: ans.question,
        options: ans.options,
        selectedAnswer: ans.selectedAnswer,
        correctAnswer: ans.correctAnswer,
        isCorrect: ans.isCorrect,
      })),
    }));

    const totalStudents = students.length;
    const avgScore = totalStudents > 0
      ? Math.round(students.reduce((s, a) => s + a.percentage, 0) / totalStudents)
      : 0;

    res.json({
      success: true,
      report: {
        quiz: {
          title: template.title,
          code: template.code,
          questionCount: template.questionCount,
          timePerQuestion: template.timePerQuestion,
          difficulty: template.difficulty,
          category: template.category,
          createdAt: template.createdAt,
        },
        summary: {
          totalStudents,
          avgScore,
          highestScore: totalStudents > 0 ? Math.max(...students.map(s => s.percentage)) : 0,
          lowestScore: totalStudents > 0 ? Math.min(...students.map(s => s.percentage)) : 0,
          passRate: totalStudents > 0
            ? Math.round((students.filter(s => s.percentage >= 40).length / totalStudents) * 100)
            : 0,
        },
        students,
        questionAnalysis,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
