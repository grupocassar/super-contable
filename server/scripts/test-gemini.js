/**
 * SCRIPT DE PRUEBA DE LABORATORIO - SUPER CONTABLE
 * Objetivo: Probar la extracción real de Gemini y el guardado en la DB de 23 columnas.
 * Ejecución: node server/scripts/test-gemini.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDatabase, getDatabase } = require('../config/database');
const { procesarFacturaConGemini } = require('../services/geminiService');
const Factura = require('../models/Factura');

async function testLaboratorio() {
    console.log('\n--- 🧪 LABORATORIO DE IA: SUPER CONTABLE ---');
    console.log('--- Probando extracción real con Gemini ---\n');

    try {
        // 1. Conexión a la base de datos recreada en la Fase 0
        await initDatabase();
        console.log('✅ [DB] Conexión establecida.');

        // 2. Localizar la imagen real subida por el usuario
        const imagePath = path.join(__dirname, 'factura-test.jpg');
        
        if (!fs.existsSync(imagePath)) {
            console.error('❌ [ERROR] No encontré el archivo "factura-test.jpg" en server/scripts/');
            console.log('👉 Por favor, sube una imagen real y cámbiale el nombre para continuar.');
            return;
        }

        console.log('📸 [IMG] Leyendo archivo: factura-test.jpg');
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        // 3. Llamada al motor de Gemini
        console.log('🧠 [IA] Enviando a Gemini 2.5 Flash... Esperando respuesta fiscal...');
        
        const startTime = Date.now();
        const geminiData = await procesarFacturaConGemini(base64Image, "image/jpeg");
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n✨ [IA] Extracción completada en ${duration} segundos.`);
        console.log('--------------------------------------------------');
        console.log('📊 DATOS EXTRAÍDOS (JSON):');
        console.log(JSON.stringify(geminiData, null, 2));
        console.log('--------------------------------------------------\n');

        // 4. Mapeo y Guardado en las 23 columnas de la DB
        console.log('💾 [DB] Guardando en la tabla "facturas" (Mapeo Formato 606)...');
        
        const facturaData = {
            empresa_id: 1, // Usamos la empresa por defecto para la prueba
            fecha_factura: geminiData.fecha_factura,
            rnc: geminiData.rnc,
            ncf: geminiData.ncf,
            proveedor: geminiData.proveedor,
            monto_servicios: geminiData.monto_servicios || 0,
            monto_bienes: geminiData.monto_bienes || 0,
            itbis_facturado: geminiData.itbis_facturado || 0,
            impuesto_selectivo: geminiData.impuesto_selectivo || 0,
            otros_impuestos: geminiData.otros_impuestos || 0,
            propina_legal: geminiData.propina_legal || 0,
            tipo_id: geminiData.tipo_id,
            tipo_gasto: geminiData.tipo_gasto,
            forma_pago: geminiData.forma_pago,
            total_pagado: geminiData.total_pagado,
            estado: 'pending',
            confidence_score: geminiData.confidence_score,
            drive_url: 'https://google-drive.test/factura-real',
            notas: `TEST REAL IA - Confianza: ${geminiData.confidence_score}%`
        };

        const nuevaFactura = await Factura.create(facturaData);
        
        console.log('\n✅ [RESULTADO] Prueba finalizada con éxito.');
        console.log(`📌 ID asignado en DB: ${nuevaFactura.id}`);
        console.log('📌 NCF detectado:', nuevaFactura.ncf);
        console.log('📌 Proveedor:', nuevaFactura.proveedor);
        console.log('\n🚀 Si los datos arriba son correctos, el motor está listo para producción.');

    } catch (error) {
        console.error('\n❌ [ERROR CRÍTICO]');
        console.error('Mensaje:', error.message);
        if (error.message.includes('API key')) {
            console.log('👉 Revisa tu archivo .env, la GOOGLE_API_KEY no parece ser válida.');
        }
    } finally {
        process.exit(0);
    }
}

testLaboratorio();