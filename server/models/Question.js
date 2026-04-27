const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: (arr) => arr.length === 4,
      message: 'Exactly 4 options are required',
    },
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required'],
    trim: true,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  category: {
    type: String,
    default: 'General',
    trim: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  source: {
    type: String,
    enum: ['pdf', 'manual', 'api'],
    default: 'manual',
  },
  sourceFile: {
    type: String,
    default: null,
  },
  tenantId: {
    type: String,
    required: [true, 'Tenant ID is required'],
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for tenant-scoped queries
questionSchema.index({ tenantId: 1, difficulty: 1 });
questionSchema.index({ tenantId: 1, category: 1 });
questionSchema.index({ tenantId: 1, tags: 1 });

module.exports = mongoose.model('Question', questionSchema);
