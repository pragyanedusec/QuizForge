const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  apiKey: {
    type: String,
    required: true,
    unique: true,
  },
  settings: {
    defaultTimeLimit: { type: Number, default: 600 },
    defaultQuestionCount: { type: Number, default: 10 },
    defaultTimePerQuestion: { type: Number, default: 30 },  // seconds per question
    // Feature toggles
    shuffleOptions: { type: Boolean, default: true },
    leaderboardEnabled: { type: Boolean, default: true },
    timerEnabled: { type: Boolean, default: true },
    showCorrectAnswers: { type: Boolean, default: true },
    allowRetake: { type: Boolean, default: true },
    gamificationEnabled: { type: Boolean, default: false },
    // Anti-cheat + access control
    antiCheat: { type: Boolean, default: true },   // enforce single active session
    maxAttempts: { type: Number, default: 0 },     // 0 = unlimited per-tenant default
    difficultyMix: {
      easy: { type: Number, default: 30 },
      medium: { type: Number, default: 50 },
      hard: { type: Number, default: 20 },
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Tenant', tenantSchema);
