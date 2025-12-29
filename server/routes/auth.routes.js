const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const googleAuthController = require('../controllers/googleAuthController'); 
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User'); // ✅ IMPORTANTE: Importar modelo

// Rutas existentes
router.post('/login', authController.login);

// ✅ FIX: Obtener datos FRESCOS de la base de datos
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        
        // Devolvemos el usuario actualizado (incluyendo drive_connected)
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error verificando sesión' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// Rutas de Google OAuth
router.get('/google/connect', authenticateToken, googleAuthController.getGoogleAuthURL);
router.get('/google/callback', googleAuthController.googleAuthCallback);

module.exports = router;