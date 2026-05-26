const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { authorizeRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);
router.get('/profile', userController.getProfile);
router.get('/team', userController.getTeamUsers);
router.post('/change-password', userController.changePassword);

// Admin only routes
router.use(authorizeRole('Admin'));
router.get('/import-template', userController.importTemplate);
router.post('/import-preview', userController.uploadMemory.single('file'), userController.importPreview);
router.post('/import-submit', userController.importSubmit);
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
