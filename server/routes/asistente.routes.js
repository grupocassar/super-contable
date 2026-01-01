const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getFacturas,
  updateFactura,
  aprobarLote,
  checkDuplicado
} = require('../controllers/asistenteController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

/**
 * RUTAS DEL ASISTENTE
 * Protegidas por Token y Verificación de Rol
 * Maneja el flujo de validación de facturas antes de que lleguen al contable.
 */

// Aplicar middlewares de seguridad a todas las rutas de este archivo
router.use(authenticateToken);
router.use(requireRole(['asistente']));

router.get('/dashboard', getDashboard);
router.get('/facturas', getFacturas);
router.get('/facturas/check-duplicado', checkDuplicado);
router.put('/facturas/:id', updateFactura);
router.post('/aprobar-lote', aprobarLote);

module.exports = router;