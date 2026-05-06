const express = require('express');
const multer = require('multer');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

// Wrap multer middleware to catch file filter / size limit errors
const handleMulterError = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File vượt quá giới hạn 5MB' });
        }
        return res.status(400).json({ message: 'Lỗi tải file: ' + err.message });
      }
      if (err) {
        return res.status(400).json({ message: err.message || 'Lỗi tải file' });
      }
      next();
    });
  };
};

router.use(verifyToken);

// Employee/Manager/Admin endpoints
router.get('/:id/preview', templateController.previewTemplateById);

// Admin-only endpoints
router.get('/', authorizeRole('Admin'), templateController.getAllTemplates);
router.post('/preview', authorizeRole('Admin'), handleMulterError(templateController.uploadMemory.single('file')), templateController.previewTemplate);
router.post('/upload', authorizeRole('Admin'), handleMulterError(templateController.upload.single('file')), templateController.uploadTemplate);
router.delete('/:id', authorizeRole('Admin'), templateController.deleteTemplate);

module.exports = router;
