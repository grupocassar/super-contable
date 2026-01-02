const TelegramBot = require('node-telegram-bot-api');
const { getDatabase } = require('../config/database');

let bot;
const processingQueue = new Set();
const awaitingRNC = new Map(); // telegram_id → { chatId, fileData }

/**
 * Inicializa el Bot de Telegram con lógica de encolamiento
 */
const initTelegramBot = () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN no encontrado en el entorno.');
        return;
    }

    bot = new TelegramBot(token, { polling: true });
    console.log('🤖 Super Contable Bot: ONLINE (Modo Asíncrono con Colas)...');

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

                // Recuperar datos del archivo y encolar
                const pendingData = awaitingRNC.get(telegramId);
                awaitingRNC.delete(telegramId);

                // Encolar la factura original
                await encolarFactura(chatId, telegramId, empresa.id, pendingData.fileData, firstName);

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
                const usuarioTG = await registrarUsuarioTelegram(db, telegramId, msg.from.username || '', firstName, chatId);

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

                // Usuario ya tiene empresa - encolar directamente
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

                await encolarFactura(chatId, telegramId, empresaId, { fileId, mimeType, ext, messageId: msg.message_id }, firstName);

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
 * NUEVA FUNCIÓN: Encola la factura en vez de procesarla
 */
async function encolarFactura(chatId, telegramId, empresaId, fileData, firstName) {
    try {
        const db = getDatabase();

        // Obtener el ID del telegram_user
        const usuarioTG = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM telegram_users WHERE telegram_id = ?', [telegramId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Insertar en la cola de jobs
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO jobs_queue (
                    telegram_user_id, 
                    empresa_id, 
                    file_id, 
                    mime_type, 
                    file_ext, 
                    message_id
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [usuarioTG.id, empresaId, fileData.fileId, fileData.mimeType, fileData.ext, fileData.messageId], 
            function(err) {
                if (err) reject(err);
                else {
                    console.log(`📥 Job #${this.lastID} encolado - Usuario: ${firstName}, Empresa ID: ${empresaId}`);
                    resolve();
                }
            });
        });

        // RESPUESTA INMEDIATA AL USUARIO (<2 segundos) - CORREGIDO
        bot.sendMessage(chatId, `✅ Factura recibida correctamente.`);

    } catch (error) {
        console.error('❌ Error encolando factura:', error.message);
        bot.sendMessage(chatId, `⚠️ Error al recibir factura: ${error.message}`);
    }
}

/**
 * Busca o registra al usuario de Telegram
 */
function registrarUsuarioTelegram(db, telegramId, username, firstName, chatId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT id, empresa_id FROM telegram_users WHERE telegram_id = ?', [telegramId], (err, row) => {
            if (err) return reject(err);
            if (row) {
                // Usuario existe - actualizar nombre y chat_id
                db.run('UPDATE telegram_users SET first_name = ?, chat_id = ? WHERE telegram_id = ?', 
                    [firstName, chatId, telegramId], 
                    (err) => {
                        if (err) console.warn('⚠️ Error actualizando usuario:', err.message);
                    }
                );
                resolve(row);
            } else {
                // Usuario nuevo - incluir chat_id
                db.run('INSERT INTO telegram_users (telegram_id, username, first_name, chat_id) VALUES (?, ?, ?, ?)', 
                    [telegramId, username, firstName, chatId], 
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
 * Notifica al usuario que su factura fue rechazada
 * Reenvía la imagen original para que pueda corregirla
 */
async function notificarRechazo(facturaId) {
    if (!bot) {
        console.warn('⚠️ Bot no disponible para notificar rechazo');
        return;
    }

    try {
        const db = getDatabase();

        // Obtener datos de la factura y el job original
        const jobData = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    jq.file_id,
                    tu.chat_id,
                    tu.first_name,
                    f.ncf,
                    f.proveedor,
                    f.total_pagado
                FROM facturas f
                JOIN telegram_users tu ON f.telegram_user_id = tu.id
                LEFT JOIN jobs_queue jq ON jq.telegram_user_id = tu.id 
                    AND jq.message_id = f.telegram_message_id
                WHERE f.id = ?
                LIMIT 1
            `, [facturaId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!jobData || !jobData.chat_id || !jobData.file_id) {
            console.warn(`⚠️ No se pudo notificar rechazo - Factura #${facturaId} sin datos completos`);
            return;
        }

        // Reenviar la imagen original
        await bot.sendPhoto(jobData.chat_id, jobData.file_id, {
            caption: `❌ Esta factura no pudo procesarse.\n\n` +
                     `Por favor, enviá una foto más clara o verificá que la factura sea legible.\n\n` +
                     `💡 Tip: Asegurate de que la imagen tenga buena iluminación y esté enfocada.`
        });

        console.log(`📤 Notificación de rechazo enviada a ${jobData.first_name} (Factura #${facturaId})`);

    } catch (error) {
        console.error(`❌ Error notificando rechazo de Factura #${facturaId}:`, error.message);
    }
}

/**
 * Exporta el bot para que el worker pueda usarlo
 */
const getBot = () => bot;

module.exports = { initTelegramBot, getBot, notificarRechazo };