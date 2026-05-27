const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.use(verifyToken);

// Employee routes
router.post('/submit-personal', upload.single('attachment'), reviewController.submitPersonalReview);
router.get('/my-reviews', reviewController.getMyReviews);

// Manager, Leader & Admin routes
router.get('/team', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.getTeamReviews);
router.put('/:id/approve', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.approveReview);
router.get('/export-excel', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.exportTeamExcel);
router.get('/:id/attachment', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.downloadAttachment);

router.post('/export-draft-docx', authorizeRole('Employee', 'Leader', 'Manager', 'Admin'), reviewController.exportDraftDocx);

module.exports = router;
