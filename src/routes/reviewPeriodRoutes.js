const express = require('express');
const router = express.Router();
const reviewPeriodController = require('../controllers/reviewPeriodController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);

// Accessible to all users (or Manager/Admin)
router.get('/active', reviewPeriodController.getActiveReviewPeriod);

// Admin, Manager & Leader can see all periods
router.get('/', authorizeRole('Admin', 'Manager', 'Leader'), reviewPeriodController.getAllReviewPeriods);

// Admin only routes for period management
router.use(authorizeRole('Admin'));
router.get('/:id', reviewPeriodController.getReviewPeriodById);
router.post('/', reviewPeriodController.createReviewPeriod);
router.put('/:id', reviewPeriodController.updateReviewPeriod);
router.delete('/:id', reviewPeriodController.deleteReviewPeriod);

module.exports = router;
