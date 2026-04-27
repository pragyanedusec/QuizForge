const mongoose = require('mongoose');

/**
 * UploadJob — tracks async PDF processing status
 * PDF parsing can be slow; this allows non-blocking uploads
 */
const uploadJobSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  progress: {
    type: Number,
    default: 0,       // 0-100
  },
  extractedCount: {
    type: Number,
    default: 0,
  },
  needsReviewCount: {
    type: Number,
    default: 0,
  },
  lowConfidenceCount: {
    type: Number,
    default: 0,
  },
  questions: [{
    question: String,
    options: [String],
    correctAnswer: String,
    difficulty: { type: String, default: 'medium' },
    category: { type: String, default: 'General' },
    needsReview: { type: Boolean, default: true },
    confidence: { type: Number, default: null },
  }],
  // Raw extracted text — lightweight audit trail, avoids needing to re-upload PDF
  // Stored truncated (max 50KB) to prevent bloat
  rawText: {
    type: String,
    default: null,
    select: false,  // excluded from normal queries, fetch explicitly if needed
  },
  error: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
});

module.exports = mongoose.model('UploadJob', uploadJobSchema);
