/**
 * Worker Service - Procesa la cola de facturas en segundo plano
 * Se ejecuta cada 5 segundos para procesar jobs pendientes
 */

const axios = require('axios');
const { google } = require('googleapis');
const { getDatabase } = require('../config/database');
const { uploadToDrive } = require('./driveService');
const { procesarFacturaConGemini } = require('./geminiService');
const Factura = require('../models/Factura');

let bot; // Referencia al bot de Telegram (se inyecta desde telegramService)
let workerInterval;
let isProcessing = false;

/**
 * Inicializa el worker y comienza a procesar la cola
 */
const initWorker = (telegramBot) => {
    bot = telegramBot;
    
    console.log('⚙️ Worker Service iniciado. Procesando cola cada 5 segundos...');
    
    workerInterval = setInterval(async () => {
        if (!isProcessing) {
            await procesarCola();
        }
    }, 5000);
};

/**
 * Detiene el worker (útil para shutdown graceful)
 */
const stopWorker = () => {
    if (workerInterval) {
        clearInterval(workerInterval);
        console.log('🛑 Worker Service detenido.');
    }
};

/**
 * Procesa todos los jobs pendientes en la cola
 */
async function procesarCola() {
    isProcessing = true;
    
    try {
        const db = getDatabase();
        const jobs = await obtenerJobsPendientes(db);
        
        if (jobs.length > 0) {
            console.log(`🔄 Procesando ${jobs.length} job(s) pendientes...`);
            
            for (const job of jobs) {
                await procesarJob(db, job);
            }
        }
    } catch (error) {
        console.error('❌ Error en Worker Service:', error.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Obtiene jobs con estado 'pending' que no hayan superado max_intentos
 */
function obtenerJobsPendientes(db) {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM jobs_queue 
            WHERE estado = 'pending' 
            AND intentos < max_intentos
            ORDER BY created_at ASC
            LIMIT 10
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Procesa un job individual: descarga, IA, Drive, BD
 */
async function procesarJob(db, job) {
    const jobId = job.id;
    
    try {
        // Marcar como "processing"
        await actualizarEstadoJob(db, jobId, 'processing', null);
        
        console.log(`🧠 Procesando Job #${jobId} - Empresa ID: ${job.empresa_id}`);
        
        // 1. Obtener datos del contable (para OAuth de Drive)
        const contable = await obtenerContableDeEmpresa(db, job.empresa_id);
        
        if (!contable || !contable.drive_refresh_token) {
            throw new Error('Contable sin credenciales de Google Drive');
        }
        
        // 2. Configurar OAuth2
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL
        );
        
        oauth2Client.setCredentials({
            refresh_token: contable.drive_refresh_token
        });
        
        // 3. Descargar archivo desde Telegram
        const fileLink = await bot.getFileLink(job.file_id);
        const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);
        
        // 4. Procesamiento IA (Gemini)
        let geminiData = {};
        try {
            const base64Image = fileBuffer.toString('base64');
            geminiData = await procesarFacturaConGemini(base64Image, job.mime_type);
        } catch (iaError) {
            console.warn(`⚠️ Error en IA para Job #${jobId}:`, iaError.message);
        }
        
        // 5. Subir a Google Drive
        const fileName = `Job_${jobId}_${Date.now()}.${job.file_ext}`;
        const driveLink = await uploadToDrive(oauth2Client, fileBuffer, fileName, job.mime_type);
        
        // 6. Obtener telegram_user para guardar en factura
        const telegramUser = await obtenerTelegramUser(db, job.telegram_user_id);
        
        // 7. Crear registro en tabla facturas
        const notas = geminiData.confidence_score < 80 ? "⚠️ Revisar datos (Baja confianza IA)" : "";
        
        const facturaData = {
            empresa_id: job.empresa_id,
            telegram_user_id: telegramUser.id,
            telegram_message_id: job.message_id,
            fecha_factura: geminiData.fecha_factura || null,
            rnc: geminiData.rnc || null,
            ncf: geminiData.ncf || null,
            proveedor: geminiData.proveedor || `TG_User_${telegramUser.telegram_id}`,
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
        
        // 8. Marcar job como completado
        await actualizarEstadoJob(db, jobId, 'completed', null);
        
        // 9. Notificar al usuario (opcional)
        if (bot && telegramUser.chat_id) {
            bot.sendMessage(telegramUser.chat_id, '✅ Factura procesada correctamente.');
        }
        
        console.log(`✅ Job #${jobId} completado exitosamente.`);
        
    } catch (error) {
        console.error(`❌ Error procesando Job #${jobId}:`, error.message);
        
        // Incrementar intentos y guardar error
        const nuevoIntento = job.intentos + 1;
        
        if (nuevoIntento >= job.max_intentos) {
            // Marcarlo como failed
            await actualizarEstadoJob(db, jobId, 'failed', error.message);
            
            // Notificar al usuario del fallo (opcional)
            if (bot) {
                const telegramUser = await obtenerTelegramUser(db, job.telegram_user_id);
                if (telegramUser.chat_id) {
                    bot.sendMessage(telegramUser.chat_id, 
                        `❌ No pudimos procesar tu factura después de ${job.max_intentos} intentos. Por favor, intenta nuevamente.`
                    );
                }
            }
        } else {
            // Reintentar: volver a pending con intentos incrementados
            await incrementarIntentosJob(db, jobId, nuevoIntento, error.message);
        }
    }
}

/**
 * Actualiza el estado de un job
 */
function actualizarEstadoJob(db, jobId, estado, errorMessage) {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        const campo = estado === 'processing' ? 'started_at' : 'completed_at';
        
        db.run(`
            UPDATE jobs_queue 
            SET estado = ?, ${campo} = ?, error_message = ?
            WHERE id = ?
        `, [estado, now, errorMessage, jobId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Incrementa el contador de intentos de un job
 */
function incrementarIntentosJob(db, jobId, intentos, errorMessage) {
    return new Promise((resolve, reject) => {
        db.run(`
            UPDATE jobs_queue 
            SET intentos = ?, error_message = ?, estado = 'pending'
            WHERE id = ?
        `, [intentos, errorMessage, jobId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Obtiene los datos del contable dueño de la empresa
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

/**
 * Obtiene datos del usuario de Telegram
 */
function obtenerTelegramUser(db, telegramUserId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT id, telegram_id, first_name 
            FROM telegram_users 
            WHERE id = ?
        `, [telegramUserId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

module.exports = { initWorker, stopWorker };