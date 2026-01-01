const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { google } = require('googleapis'); 
const { getDatabase } = require('../config/database');
const { uploadToDrive } = require('./driveService');
const { procesarFacturaConGemini } = require('./geminiService');
const Factura = require('../models/Factura');

let bot;
const processingQueue = new Set();
const awaitingRNC = new Map(); // telegram_id → { chatId, fileData }

/**
 * Inicializa el Bot de Telegram con lógica de identificación de usuario y procesamiento IA.
 */
const initTelegramBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN no encontrado en el entorno.');
        return;
    }

    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Super Contable Bot: ONLINE (Modo OAuth2 + IA)...');

    bot.on('polling_error', (error) => console.error(`[Telegram Error] ${error.message}`));

    // HANDLER ÚNICO DE MENSAJES (texto, fotos, documentos)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id.toString();
        const firstName = msg.from.first_name || 'Usuario';
        
        // ============================================
        // 1. COMANDO /START
        // ============================================
        if (msg.text === '/start') {
            bot.sendMessage(chatId, `👋 ¡Hola ${firstName}!\n\nEnvíame fotos de tus facturas y yo me encargo del resto.`);
            return;
        }

        // ============================================
        // 2. RESPUESTA DE RNC
        // ============================================
        if (msg.text && awaitingRNC.has(telegramId)) {
            const rncIngresado = msg.text.trim().replace(/-/g, ''); // Quitar guiones
            const db = getDatabase();

            // Validar formato RNC (9 u 11 dígitos)
            if (!/^\d{9}$|^\d{11}$/.test(rncIngresado)) {
                bot.sendMessage(chatId, 
                    `❌ RNC inválido.\n\n` +
                    `El RNC debe tener 9 u 11 dígitos.\n` +
                    `Ejemplo: 130-12345-6 o 13012345678\n\n` +
                    `Por favor, enviá el RNC correcto.`
                );
                return;
            }

            try {
                // Buscar empresa por RNC
                const empresa = await buscarEmpresaPorRNC(db, rncIngresado);

                if (!empresa) {
                    bot.sendMessage(chatId, 
                        `❌ RNC "${formatearRNC(rncIngresado)}" no encontrado.\n\n` +
                        `Verificá que sea el RNC correcto o contactá a tu contador.`
                    );
                    return;
                }

                // Vincular usuario con empresa
                await vincularUsuarioEmpresa(db, telegramId, empresa.id);
                
                bot.sendMessage(chatId, 
                    `✅ ¡Perfecto! Quedaste vinculado a:\n` +
                    `📦 ${empresa.nombre}\n` +
                    `🆔 RNC: ${formatearRNC(empresa.rnc)}\n\n` +
                    `Ahora podés enviar tus facturas.`
                );

                // Recuperar datos del archivo y procesar
                const pendingData = awaitingRNC.get(telegramId);
                awaitingRNC.delete(telegramId);

                // Procesar la factura original
                await procesarFactura(chatId, telegramId, empresa.id, pendingData.fileData, firstName);

            } catch (error) {
                console.error('Error vinculando usuario:', error);
                bot.sendMessage(chatId, '⚠️ Error al vincular. Contactá a tu contador.');
                awaitingRNC.delete(telegramId);
            }
            return;
        }

        // ============================================
        // 3. PROCESAMIENTO DE FOTOS/DOCUMENTOS
        // ============================================
        const isPhoto = msg.photo && msg.photo.length > 0;
        const isDoc = msg.document;

        if (isPhoto || isDoc) {
            // Evitar procesar mensajes duplicados
            if (processingQueue.has(msg.message_id)) return;
            processingQueue.add(msg.message_id);

            bot.sendChatAction(chatId, 'upload_photo');

            try {
                const db = getDatabase();
                
                // Identificar al Usuario de Telegram y su Empresa
                const usuarioTG = await registrarUsuarioTelegram(db, telegramId, msg.from.username || '', firstName);

                // VERIFICAR SI TIENE EMPRESA ASIGNADA
                if (!usuarioTG.empresa_id) {
                    // Guardar datos del archivo para procesar después
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

                    awaitingRNC.set(telegramId, {
                        chatId,
                        fileData: { fileId, mimeType, ext, messageId: msg.message_id }
                    });

                    bot.sendMessage(chatId, 
                        `👋 ¡Hola ${firstName}!\n\n` +
                        `Es tu primera vez usando el bot.\n\n` +
                        `📋 Por favor, enviá el RNC de tu empresa.\n` +
                        `(Lo encontrás en cualquiera de tus facturas)\n\n` +
                        `Ejemplo: 130-12345-6`
                    );

                    processingQueue.delete(msg.message_id);
                    return;
                }

                // Usuario ya tiene empresa - procesar directamente
                const empresaId = usuarioTG.empresa_id;

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

                await procesarFactura(chatId, telegramId, empresaId, { fileId, mimeType, ext, messageId: msg.message_id }, firstName);

            } catch (error) {
                console.error('❌ Error en Telegram Service:', error.message);
                bot.sendMessage(chatId, `⚠️ Error: ${error.message}`);
            } finally {
                processingQueue.delete(msg.message_id);
            }
        }
    });
};

/**
 * Procesa una factura: descarga, IA, Drive, BD
 */
async function procesarFactura(chatId, telegramId, empresaId, fileData, firstName) {
    try {
        const db = getDatabase();

        // 1. Buscar al Contable responsable de la empresa para usar su Drive
        const contable = await obtenerContableDeEmpresa(db, empresaId);

        if (!contable || !contable.drive_refresh_token) {
            throw new Error('El contable no ha vinculado su cuenta de Google Drive.');
        }

        // 2. Configurar el Cliente OAuth2 con las credenciales del contable
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL
        );

        oauth2Client.setCredentials({
            refresh_token: contable.drive_refresh_token
        });

        // 3. Descargar el archivo desde los servidores de Telegram
        const fileLink = await bot.getFileLink(fileData.fileId);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);

        // 4. PROCESAMIENTO IA (Gemini extrae los datos para el 606)
        console.log(`🧠 IA analizando factura de ${firstName} para Empresa ID: ${empresaId}...`);
        let geminiData = {};
        try {
            const base64Image = fileBuffer.toString('base64');
            geminiData = await procesarFacturaConGemini(base64Image, fileData.mimeType);
        } catch (iaError) {
            console.error('⚠️ Fallo la extracción IA:', iaError.message);
        }

        // 5. SUBIR A DRIVE (Usando el Drive personal del contable)
        const fileName = `Factura_${firstName}_${Date.now()}.${fileData.ext}`;
        const driveLink = await uploadToDrive(oauth2Client, fileBuffer, fileName, fileData.mimeType);

        // 6. GUARDAR EN BD
        const usuarioTG = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM telegram_users WHERE telegram_id = ?', [telegramId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        let notas = geminiData.confidence_score < 80 ? "⚠️ Revisar datos (Baja confianza IA)" : "";

        const facturaData = {
            empresa_id: empresaId,
            telegram_user_id: usuarioTG.id,
            telegram_message_id: fileData.messageId,
            fecha_factura: geminiData.fecha_factura || null,
            rnc: geminiData.rnc || null,
            ncf: geminiData.ncf || null,
            proveedor: geminiData.proveedor || `TG: ${firstName}`,
            monto_servicios: geminiData.monto_servicios || 0,
            monto_bienes: geminiData.monto_bienes || 0,
            itbis_facturado: geminiData.itbis_facturado || 0,
            impuesto_selectivo: geminiData.impuesto_selectivo || 0,
            otros_impuestos: geminiData.otros_impuestos || 0,
            propina_legal: geminiData.propina_legal || 0,
            tipo_id: geminiData.tipo_id || null,
            tipo_gasto: geminiData.tipo_gasto || null,
            forma_pago: geminiData.forma_pago || null,
            total_pagado: geminiData.total_pagado || 0,
            estado: 'pending',
            confidence_score: geminiData.confidence_score || 0,
            drive_url: driveLink,
            notas: notas
        };

        await Factura.create(facturaData);

        bot.sendMessage(chatId, '✅ Factura recibida y procesada correctamente.');
        console.log(`✨ Éxito: Registro creado para ${firstName}.`);

    } catch (error) {
        console.error('❌ Error procesando factura:', error.message);
        bot.sendMessage(chatId, `⚠️ Error: ${error.message}`);
    }
}

/**
 * Busca o registra al usuario de Telegram para mantener la relación con la empresa.
 */
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

/**
 * Busca empresa por RNC
 */
function buscarEmpresaPorRNC(db, rnc) {
    return new Promise((resolve, reject) => {
        // Buscar con o sin guiones
        const rncLimpio = rnc.replace(/-/g, '');
        db.get('SELECT id, nombre, rnc FROM empresas WHERE REPLACE(rnc, \'-\', \'\') = ?', 
            [rncLimpio], 
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

/**
 * Vincula usuario de Telegram con empresa
 */
function vincularUsuarioEmpresa(db, telegramId, empresaId) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE telegram_users SET empresa_id = ? WHERE telegram_id = ?', 
            [empresaId, telegramId], 
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

/**
 * Formatea RNC para mostrar (agrega guiones)
 */
function formatearRNC(rnc) {
    const limpio = rnc.replace(/-/g, '');
    if (limpio.length === 9) {
        return `${limpio.slice(0, 3)}-${limpio.slice(3, 8)}-${limpio.slice(8)}`;
    }
    return rnc;
}

/**
 * Obtiene los datos del contable dueño de la empresa para usar sus tokens de Google.
 */
function obtenerContableDeEmpresa(db, empresaId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT u.id, u.email, u.drive_refresh_token 
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