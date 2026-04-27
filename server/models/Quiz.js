const mongoose = require('mongoose');

/**
 * Quiz Session Model
 * Tracks the full lifecycle: creation → in-progress → completed/expired
 * Server-authoritative timer via expiresAt prevents client-side cheating
 */
const quizSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    default: 'anonymous',
  },
  userName: {
    type: String,
    default: 'Anonymous',
  },
  questions: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    question: String,
    options: [String],           // shuffled options for this session
    correctAnswer: String,
  }],
  totalQuestions: {
    type: Number,
    required: true,
  },
  timeLimit: {
    type: Number,  // total time in seconds (timePerQuestion × totalQuestions)
    required: true,
    default: 600,
  },
  timePerQuestion: {
    type: Number,  // seconds per question
    default: 30,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed',
  },
  category: {
    type: String,
    default: 'General',
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'expired'],
    default: 'in-progress',
  },
  quizCode: {
    type: String,
    default: null,
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    // index defined below with expireAfterSeconds (TTL)
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-check if session is expired
quizSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

// Get remaining time in seconds
quizSchema.methods.getRemainingTime = function () {
  const remaining = (this.expiresAt - new Date()) / 1000;
  return Math.max(0, Math.round(remaining));
};

// ── Indexes ────────────────────────────────────────────────────────────────
quizSchema.index({ tenantId: 1, quizCode: 1 });
quizSchema.index({ tenantId: 1, userName: 1, quizCode: 1, status: 1 }); // single-session lookup
quizSchema.index({ tenantId: 1, userId: 1 });
quizSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 }); // TTL: auto-delete sessions 1 day after expiry

module.exports = mongoose.model('Quiz', quizSchema);

