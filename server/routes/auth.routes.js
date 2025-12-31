const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const googleAuthController = require('../controllers/googleAuthController'); 
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

/**
 * Rutas de Autenticación y Sesión
 * Versión completa con lógica de verificación integrada
 */

// Login tradicional
router.post('/login', authController.login);

// Verificación de sesión (Utilizada por el Dashboard para validar JWT y estado de Drive)
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        // Buscamos al usuario por el ID que viene en el Token (req.user.userId)
        const user = await User.findById(req.user.userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuario no encontrado' 
            });
        }
        
        // Eliminamos la contraseña de la respuesta por seguridad
        delete user.password;
        
        // Devolvemos el usuario con sus datos actuales (role, drive_refresh_token, etc.)
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                email: user.email,
                role: user.role, // Sincronizado con el nuevo esquema
                drive_connected: !!user.drive_refresh_token, // Booleano para el Dashboard
                nombre_completo: user.nombre_completo || user.email.split('@')[0]
            }
        });
    } catch (error) {
        console.error('❌ Error en /verify:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Error al verificar la integridad de la sesión' 
        });
    }
});

// Logout (Informativo, el frontend elimina el token)
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
});

// --- RUTAS DE GOOGLE OAUTH ---

// Iniciar proceso de conexión con Google Drive
router.get('/google/connect', authenticateToken, googleAuthController.getGoogleAuthURL);

// Callback donde Google devuelve el código de autorización
router.get('/google/callback', googleAuthController.googleAuthCallback);

module.exports = router;