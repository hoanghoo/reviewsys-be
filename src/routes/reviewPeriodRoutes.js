const express = require('express');
const router = express.Router();
const reviewPeriodController = require('../controllers/reviewPeriodController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);
router.use(authorizeRole('Admin'));

router.get('/', reviewPeriodController.getAllReviewPeriods);
router.get('/:id', reviewPeriodController.getReviewPeriodById);
router.post('/', reviewPeriodController.createReviewPeriod);
router.put('/:id', reviewPeriodController.updateReviewPeriod);
router.delete('/:id', reviewPeriodController.deleteReviewPeriod);

module.exports = router;
