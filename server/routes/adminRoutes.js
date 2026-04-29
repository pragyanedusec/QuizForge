const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `pdf_${Date.now()}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// All admin routes require authentication
router.use(requireAuth);

// PDF Upload (async processing)
router.post('/upload-pdf', upload.single('pdf'), adminController.uploadPDF);
router.get('/upload-status/:jobId', adminController.getUploadStatus);

// Question CRUD
router.get('/questions', adminController.getQuestions);
router.post('/questions', adminController.saveQuestions);
router.delete('/questions', adminController.deleteAllQuestions);  // Delete ALL
router.put('/questions/:id', adminController.updateQuestion);
router.delete('/questions/:id', adminController.deleteQuestion);

// Dashboard stats
router.get('/stats', adminController.getStats);

// Quiz Templates (admin creates quizzes, students join via code)
const templateController = require('../controllers/templateController');
router.get('/quiz-templates', templateController.listTemplates);
router.post('/quiz-templates', templateController.createTemplate);
router.patch('/quiz-templates/:id/toggle', templateController.toggleTemplate);
router.delete('/quiz-templates/:id', templateController.deleteTemplate);

// Quiz Reports
const reportController = require('../controllers/reportController');
router.get('/reports/quizzes', reportController.listQuizReports);
router.get('/reports/quizzes/:code', reportController.getQuizReport);

module.exports = router;
