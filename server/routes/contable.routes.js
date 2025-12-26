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
// NUEVA RUTA: Actualizar campos de una factura (NCF, Proveedor, Total, etc.)
router.put('/facturas/:id', contableController.updateFactura);

// Gestión de Asistentes (CRUD Básico)
router.get('/asistentes', contableController.getAsistentes);
router.post('/asistentes', contableController.createAsistente);
router.put('/asistentes/:id', contableController.updateAsistente);

// Gestión de Asignaciones
// Obtener qué empresas tiene un asistente
router.get('/asistentes/:id/empresas', contableController.getAsistenteEmpresas);
// Guardar/Actualizar asignaciones de empresas a un asistente
router.post('/asistentes/:id/empresas', contableController.assignEmpresasToAsistente);

module.exports = router;