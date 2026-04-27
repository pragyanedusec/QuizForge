require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const tenantMiddleware = require('./middleware/tenant');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));

// ── Rate limiting ──────────────────────────────────────────────────────────
// Global safety net
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later' },
});
app.use('/api/', globalLimiter);

// Tighter limit for quiz start — prevents session spam
const quizStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `${ipKeyGenerator(req)}:${req.headers['x-api-key'] || ''}`,
  message: { success: false, error: 'Too many quiz attempts. Please wait before trying again.' },
  skipSuccessfulRequests: false,
});

// Join by code — moderate limit
const quizJoinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `${ipKeyGenerator(req)}:${req.headers['x-api-key'] || ''}`,
  message: { success: false, error: 'Too many join attempts. Please slow down.' },
});

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    service: 'QuizForge API',
    timestamp: new Date(),
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
    },
    env: process.env.NODE_ENV || 'development',
  });
});

// Export limiters for use in routes
app.set('quizStartLimiter', quizStartLimiter);
app.set('quizJoinLimiter', quizJoinLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', tenantMiddleware, require('./routes/adminRoutes'));
app.use('/api/quiz', tenantMiddleware, require('./routes/quizRoutes'));


// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Connect to MongoDB and start server
const { cleanupOrphanFiles } = require('./utils/fileCleanup');

connectDB().then(async () => {
  // Clean up any temp PDFs left by a previous crash
  await cleanupOrphanFiles();

  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════╗
  ║       🔥 QuizForge API Server 🔥          ║
  ╠═══════════════════════════════════════════╣
  ║  Port:  ${PORT}                              ║
  ║  Env:   ${(process.env.NODE_ENV || 'development').padEnd(24)}║
  ║  Auth:  JWT + Tenant API Key              ║
  ╚═══════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


module.exports = app;
