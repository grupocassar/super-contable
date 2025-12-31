const express = require('express');
const router = express.Router();
const contableController = require('../controllers/contableController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

/**
 * RUTAS DEL CONTABLE
 * Protegidas por Token y Verificación de Rol
 */

// Aplicar middlewares de seguridad a todas las rutas de este archivo
router.use(authenticateToken);
router.use(requireRole(['contable']));

// --- Gestión de Dashboard y Empresas ---
router.get('/dashboard', contableController.getDashboard);
router.get('/empresas', contableController.getEmpresas);
router.post('/empresas', contableController.createEmpresa);

// --- Gestión de Facturas (606) ---
router.get('/facturas', contableController.getFacturas);
router.put('/facturas/:id', contableController.updateFactura);
router.delete('/facturas/:id', contableController.deleteFactura);

// --- Gestión de Asistentes (Contable Senior -> Asistentes) ---
router.get('/asistentes', contableController.getAsistentes);
router.post('/asistentes', contableController.createAsistente);
router.get('/asistentes/:id/empresas', contableController.getAsistenteEmpresas);
router.post('/asistentes/:id/empresas', contableController.assignEmpresasToAsistente);

// --- Herramientas e IA ---
router.get('/sugerencia-gasto', contableController.getSugerenciaGasto);
router.post('/procesar-lote', contableController.procesarLoteFacturas);

// --- Exportación Fiscal ---
router.post('/exportar-sheets', contableController.exportarASheets);

module.exports = router;