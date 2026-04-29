const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);
router.use(authorizeRole('Admin'));

router.get('/', templateController.getAllTemplates);
router.post('/upload', templateController.upload.single('file'), templateController.uploadTemplate);
router.delete('/:id', templateController.deleteTemplate);

module.exports = router;
