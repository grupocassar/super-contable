const { google } = require('googleapis');
const { getDatabase } = require('../config/database');

// Inicializar cliente OAuth con credenciales de entorno
const getOAuthClient = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );
};

/**
 * Genera la URL de autorización para que el usuario conecte su Drive.
 * Se llama desde el botón "Conectar Drive" en el frontend.
 */
const getGoogleAuthURL = (req, res) => {
    const oauth2Client = getOAuthClient();
    const userId = req.user.userId; // Obtenido del JWT middleware

    // "State" es una mochila segura para recordar quién es el usuario cuando vuelva de Google
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const scopes = [
        'https://www.googleapis.com/auth/drive.file' // Solo archivos creados por la app (Más seguro)
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Importante: Para recibir refresh_token (acceso perpetuo)
        scope: scopes,
        state: state, 
        prompt: 'consent' // Forzar pantalla de consentimiento para asegurar refresh_token
    });

    res.json({ success: true, url });
};

/**
 * Recibe el código de Google, obtiene tokens y los guarda en la BD.
 */
const googleAuthCallback = async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state) {
        return res.redirect('/views/contable/dashboard.html?drive=error_params');
    }

    try {
        // 1. Recuperar quién es el usuario desde el "State"
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        const userId = decodedState.userId;

        // 2. Canjear código por tokens (Access + Refresh)
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);

        // 3. Guardar tokens en la base de datos del usuario
        const db = getDatabase();
        
        // Preparamos la actualización. 
        // Si Google no manda refresh_token (porque ya se conectó antes), mantenemos el viejo si existe.
        let query = `UPDATE users SET drive_connected = 1, drive_access_token = ?`;
        const params = [tokens.access_token];

        if (tokens.refresh_token) {
            query += `, drive_refresh_token = ?`;
            params.push(tokens.refresh_token);
        }

        query += ` WHERE id = ?`;
        params.push(userId);

        db.run(query, params, (err) => {
            if (err) {
                console.error('❌ Error guardando tokens:', err);
                return res.redirect('/views/contable/dashboard.html?drive=error_db');
            }

            console.log(`✅ Drive conectado exitosamente para usuario ID: ${userId}`);
            // Redirigir al dashboard con éxito
            res.redirect('/views/contable/dashboard.html?drive=success');
        });

    } catch (error) {
        console.error('❌ Error en OAuth Callback:', error);
        res.redirect('/views/contable/dashboard.html?drive=error_google');
    }
};

module.exports = {
    getGoogleAuthURL,
    googleAuthCallback
};