const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const templateController = require('../controllers/templateController');

// Rate limiters (set on app instance in server.js)
const getLimiter = (req, name) => req.app.get(name) || ((r, res, n) => n());

// Join quiz by code (student enters admin-created quiz code)
router.post('/join', (req, res, next) => getLimiter(req, 'quizJoinLimiter')(req, res, next), templateController.joinByCode);

// Start quiz session — rate-limited to prevent spam
router.post('/start', (req, res, next) => getLimiter(req, 'quizStartLimiter')(req, res, next), quizController.startQuiz);

// Quiz operations (public — authenticated by tenant API key)
router.post('/submit', quizController.submitQuiz);
router.get('/session/:id', quizController.getSession);
router.get('/result/:id', quizController.getResult);
router.get('/leaderboard', quizController.getLeaderboard);
router.get('/config', quizController.getQuizConfig);

module.exports = router;
