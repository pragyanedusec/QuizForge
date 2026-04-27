const mongoose = require('mongoose');

/**
 * QuizTemplate — Admin-created quiz configuration
 * Admin sets the rules, students join via a unique code
 */
const quizTemplateSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  // Quiz configuration
  questionCount: {
    type: Number,
    required: true,
    default: 10,
  },
  timePerQuestion: {
    type: Number,
    default: 30,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'mixed'],
    default: 'mixed',
  },
  category: {
    type: String,
    default: 'all',
  },
  // Access control
  isActive: {
    type: Boolean,
    default: true,
  },
  startsAt: {
    type: Date,
    default: null,  // null = available immediately
  },
  endsAt: {
    type: Date,
    default: null,  // null = no end time
  },
  maxAttempts: {
    type: Number,
    default: 1,  // how many times a student can attempt
  },
  // Stats
  totalAttempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate a unique 6-char code
quizTemplateSchema.statics.generateCode = function () {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

module.exports = mongoose.model('QuizTemplate', quizTemplateSchema);
