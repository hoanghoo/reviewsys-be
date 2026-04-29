const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/init', authController.initAdmin); // Temporary route to initialize DB

module.exports = router;
