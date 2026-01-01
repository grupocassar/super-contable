const express = require('express');
const router = express.Router();
const contableController = require('../controllers/contableController');

// FIX: Importación correcta basada en tu archivo auth.js
const { authenticateToken } = require('../middleware/auth');

// Middleware de autenticación global para estas rutas
// Ahora pasamos la función directa, no el objeto
router.use(authenticateToken);

// --- DASHBOARD ---
router.get('/dashboard', contableController.getDashboard);

// --- EMPRESAS ---
router.get('/empresas', contableController.getEmpresas);
router.post('/empresas', contableController.createEmpresa);
router.put('/empresas/:id', contableController.updateEmpresa);

// --- FACTURAS ---
// ⚠️ IMPORTANTE: Las rutas estáticas/específicas deben ir PRIMERO
router.get('/facturas/sugerencia-gasto', contableController.getSugerenciaGasto);
router.post('/facturas/procesar-lote', contableController.procesarLoteFacturas);

// Rutas generales y dinámicas de facturas
router.get('/facturas', contableController.getFacturas);
router.put('/facturas/:id', contableController.updateFactura);
router.delete('/facturas/:id', contableController.deleteFactura);

// --- EXPORTACIÓN ---
router.post('/exportar-sheets', contableController.exportarASheets);

// --- ASISTENTES ---
router.get('/asistentes', contableController.getAsistentes);
router.post('/asistentes', contableController.createAsistente);
router.put('/asistentes/:id', contableController.updateAsistente);
router.get('/asistentes/:id/empresas', contableController.getAsistenteEmpresas);
router.post('/asistentes/:id/empresas', contableController.assignEmpresasToAsistente);

module.exports = router;