const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { google } = require('googleapis'); 
const { getDatabase } = require('../config/database');
const { uploadToDrive } = require('./driveService');

let bot;
const processingQueue = new Set();

const initTelegramBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN no encontrado.');
        return;
    }

    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Super Contable Bot: ONLINE (Modo OAuth Robusto)...');

    bot.on('polling_error', (error) => console.error(`[Telegram Error] ${error.message}`));

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id.toString();
        const username = msg.from.username || '';
        const firstName = msg.from.first_name || 'Usuario';
        
        const isPhoto = msg.photo && msg.photo.length > 0;
        const isDoc = msg.document;

        if (isPhoto || isDoc) {
            if (processingQueue.has(msg.message_id)) return;
            processingQueue.add(msg.message_id);

            bot.sendChatAction(chatId, 'upload_photo');

            try {
                const db = getDatabase();
                
                // 1. Identificar Usuario y Empresa
                const usuarioTG = await registrarUsuarioTelegram(db, telegramId, username, firstName);
                const empresaId = usuarioTG.empresa_id || 1; 

                // 2. BUSCAR AL CONTABLE
                const contable = await obtenerContableDeEmpresa(db, empresaId);

                if (!contable) {
                    throw new Error('No se encontró un contable asignado a esta empresa.');
                }

                if (!contable.drive_refresh_token) {
                    throw new Error('El sistema de almacenamiento no está configurado.');
                }

                // 3. CONFIGURAR CLIENTE OAUTH
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_CALLBACK_URL
                );

                oauth2Client.setCredentials({
                    refresh_token: contable.drive_refresh_token
                });

                // Validar/Refrescar Token
                try {
                    const tokenInfo = await oauth2Client.getAccessToken();
                    if (!tokenInfo || !tokenInfo.token) {
                        throw new Error('Fallo de autenticación con la nube.');
                    }
                    oauth2Client.setCredentials({ access_token: tokenInfo.token });
                } catch (authError) {
                    console.error('❌ Error Auth Google:', authError.message);
                    throw new Error('La conexión con la nube ha caducado.');
                }

                // 4. Descargar imagen
                let fileId, mimeType, ext;
                if (isPhoto) {
                    fileId = msg.photo[msg.photo.length - 1].file_id;
                    mimeType = 'image/jpeg';
                    ext = 'jpg';
                } else {
                    fileId = msg.document.file_id;
                    mimeType = msg.document.mime_type;
                    ext = 'pdf';
                }

                const fileLink = await bot.getFileLink(fileId);
                const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
                const fileBuffer = Buffer.from(response.data);

                // 5. SUBIR A DRIVE
                const fileName = `factura_${firstName}_${Date.now()}.${ext}`;
                console.log(`☁️ Subiendo a Drive de: ${contable.email}...`);
                
                const driveLink = await uploadToDrive(oauth2Client, fileBuffer, fileName, mimeType);

                // 6. Guardar en BD
                let notas = ""; 
                let proveedorTemp = `TG: ${firstName}`; 

                if (!usuarioTG.empresa_id) {
                    notas = "⚠️ USUARIO NO VINCULADO";
                    proveedorTemp += " (Sin Vincular)";
                }

                const stmt = db.prepare(`
                    INSERT INTO facturas (
                        empresa_id, fecha_factura, estado, drive_url, proveedor, notas, telegram_user_id
                    ) VALUES (?, DATE('now'), 'pending', ?, ?, ?, ?)
                `);
                
                stmt.run(empresaId, driveLink, proveedorTemp, notas, usuarioTG.id);

                bot.sendMessage(chatId, '☁️ Recibido correctamente');

            } catch (error) {
                console.error('❌ Error Telegram Service:', error.message);
                
                // MENSAJES DE ERROR PARA EL USUARIO FINAL
                let replyMsg = '⚠️ Error técnico al guardar.';
                
                if (error.message.includes('drive') || error.message.includes('caducado') || error.message.includes('nube')) {
                    // Mensaje claro: No es culpa del usuario, debe avisar al contable
                    replyMsg = '⚠️ Error de conexión con el sistema. Por favor notifique a su contable.';
                } else if (error.message.includes('empresa')) {
                    replyMsg = '⚠️ Su usuario no tiene una empresa asignada. Contacte a su contable.';
                }
                
                bot.sendMessage(chatId, replyMsg);
            } finally {
                processingQueue.delete(msg.message_id);
            }

        } else if (msg.text === '/start') {
            bot.sendMessage(chatId, `👋 Listo. Envíame tus facturas.`);
        }
    });
};

function registrarUsuarioTelegram(db, telegramId, username, firstName) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, empresa_id FROM telegram_users WHERE telegram_id = ?', [telegramId], (err, row) => {
            if (err) return reject(err);
            if (row) resolve(row);
            else {
                db.run('INSERT INTO telegram_users (telegram_id, username, first_name) VALUES (?, ?, ?)', 
                    [telegramId, username, firstName], 
                    function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID, empresa_id: null });
                    }
                );
            }
        });
    });
}

function obtenerContableDeEmpresa(db, empresaId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT u.id, u.email, u.drive_refresh_token, u.drive_access_token
            FROM users u
            JOIN empresas e ON e.contable_id = u.id
            WHERE e.id = ?
        `, [empresaId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

module.exports = { initTelegramBot };