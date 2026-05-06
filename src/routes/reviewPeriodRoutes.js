const express = require('express');
const router = express.Router();
const reviewPeriodController = require('../controllers/reviewPeriodController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);

// Accessible to all users (or Manager/Admin)
router.get('/active', reviewPeriodController.getActiveReviewPeriod);
router.get('/', authorizeRole('Admin', 'Manager'), reviewPeriodController.getAllReviewPeriods);

// Admin only routes
router.use(authorizeRole('Admin'));
router.get('/:id', reviewPeriodController.getReviewPeriodById);
router.post('/', reviewPeriodController.createReviewPeriod);
router.put('/:id', reviewPeriodController.updateReviewPeriod);
router.delete('/:id', reviewPeriodController.deleteReviewPeriod);

module.exports = router;
