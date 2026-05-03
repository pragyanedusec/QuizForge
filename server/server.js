require('dotenv').config();

// ── Startup validation ─────────────────────────────────────────────────────
const REQUIRED_VARS = ['MONGODB_URI'];
const WARN_VARS = [
  { key: 'JWT_SECRET', defaultVal: 'quizforge_dev_secret_change_in_production', msg: 'Using default JWT_SECRET — change this in production!' },
  { key: 'DEFAULT_TENANT_API_KEY', defaultVal: 'qf_default_key_2024', msg: 'Using default API key — set DEFAULT_TENANT_API_KEY in production!' },
];

const missingVars = REQUIRED_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('   Please set these in your .env file and restart the server.');
  process.exit(1);
}
WARN_VARS.forEach(({ key, defaultVal, msg }) => {
  if (!process.env[key] || process.env[key] === defaultVal) {
    console.warn(`⚠️  [ENV WARNING] ${msg}`);
  }
});

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
// Global safety net — keyed by API key so shared IPs (classrooms) don't share bucket
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req),
  skip: (req) => req.method === 'OPTIONS', // never rate-limit preflight
  message: { success: false, error: 'Too many requests, please try again later' },
});

// Tighter limit for quiz start — prevents session spam
const quizStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req),
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, error: 'Too many quiz attempts. Please wait before trying again.' },
  skipSuccessfulRequests: false,
});

// Join by code — generous limit for classroom use
const quizJoinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req),
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, error: 'Too many join attempts. Please slow down.' },
});

// ── CORS — must be before rate limiters so blocked requests still get CORS headers ──
const allowedOrigins = [
  process.env.CORS_ORIGIN,          // exact override from Railway variable
  'http://localhost:5173',           // local Vite dev server
  'http://localhost:4173',           // local Vite preview
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app subdomain (covers all preview/prod deployments)
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Apply global rate limiter after CORS
app.use('/api/', globalLimiter);

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
