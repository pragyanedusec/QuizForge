const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
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
    default: 'Anonymous User',
  },
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedAnswer: String,
    isCorrect: Boolean,
  }],
  score: {
    type: Number,
    default: 0,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  timeTaken: {
    type: Number, // seconds
    default: 0,
  },
  startTime: {
    type: Date,
    required: true,
  },
  submissionTime: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['submitted', 'timed-out'],
    default: 'submitted',
  },
});

attemptSchema.index({ tenantId: 1, score: -1 });
attemptSchema.index({ tenantId: 1, userId: 1 });
attemptSchema.index({ tenantId: 1, quizId: 1 });         // cascade delete
attemptSchema.index({ tenantId: 1, submissionTime: -1 }); // recent attempts sort

module.exports = mongoose.model('Attempt', attemptSchema);
