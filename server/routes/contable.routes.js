const express = require('express');
const router = express.Router();
const contableController = require('../controllers/contableController');

// Dashboard y Estadísticas
router.get('/dashboard', contableController.getDashboard);

// Gestión de Empresas
router.get('/empresas', contableController.getEmpresas);
router.post('/empresas', contableController.createEmpresa);
router.put('/empresas/:id', contableController.updateEmpresa);

// Gestión de Facturas
router.get('/facturas', contableController.getFacturas);

// Memoria Contable (Sugerencia de gasto)
router.get('/facturas/sugerencia-gasto', contableController.getSugerenciaGasto);

// ✅ FASE 3 - Paso B: Exportación a Google Sheets
router.post('/exportar-sheets', contableController.exportarASheets);

// Procesar lote (Archivar/Limpiar mesa)
router.post('/facturas/procesar-lote', contableController.procesarLoteFacturas);

// Actualizar campos de una factura
router.put('/facturas/:id', contableController.updateFactura);

// Eliminar factura
router.delete('/facturas/:id', contableController.deleteFactura);

// Gestión de Asistentes
router.get('/asistentes', contableController.getAsistentes);
router.post('/asistentes', contableController.createAsistente);
router.put('/asistentes/:id', contableController.updateAsistente);

// Gestión de Asignaciones
router.get('/asistentes/:id/empresas', contableController.getAsistenteEmpresas);
router.post('/asistentes/:id/empresas', contableController.assignEmpresasToAsistente);

module.exports = router;