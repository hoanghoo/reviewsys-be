const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);

// Employee routes
router.post('/submit-personal', reviewController.submitPersonalReview);
router.get('/my-reviews', reviewController.getMyReviews);

// Manager, Leader & Admin routes
router.get('/team', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.getTeamReviews);
router.put('/:id/approve', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.approveReview);
router.get('/export-excel', authorizeRole('Leader', 'Manager', 'Admin'), reviewController.exportTeamExcel);

router.post('/export-draft-docx', authorizeRole('Employee', 'Leader', 'Manager', 'Admin'), reviewController.exportDraftDocx);

module.exports = router;
