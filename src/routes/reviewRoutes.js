const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);

// Employee routes
router.post('/submit-personal', reviewController.submitPersonalReview);
router.get('/my-reviews', reviewController.getMyReviews);

// Manager routes
router.get('/team', authorizeRole('Manager', 'Admin'), reviewController.getTeamReviews);
router.put('/:id/approve', authorizeRole('Manager', 'Admin'), reviewController.approveReview);
router.get('/export-excel', authorizeRole('Manager', 'Admin'), reviewController.exportTeamExcel);

router.post('/export-draft-docx', authorizeRole('Employee', 'Manager', 'Admin'), reviewController.exportDraftDocx);

module.exports = router;
