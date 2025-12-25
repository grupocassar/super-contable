const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/verify', authenticateToken, authController.verify);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;