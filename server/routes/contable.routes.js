const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboard,
  getPlanYConsumo,
  getEmpresas,
  createEmpresa,
  updateEmpresa,
  getFacturas,
  updateFactura,
  deleteFactura,
  getSugerenciaGasto,
  procesarLoteFacturas,
  exportarASheets,
  createAsistente,
  getAsistentes,
  updateAsistente,
  getAsistenteEmpresas,
  assignEmpresasToAsistente,
  solicitarUpgrade,   // <--- NUEVA FUNCIÓN
  verEstadoSolicitud  // <--- NUEVA FUNCIÓN
} = require('../controllers/contableController');

// Middleware de protección: Todas las rutas requieren estar logueado
router.use(protect);

// --- DASHBOARD & PLAN ---
router.get('/dashboard', authorize('contable', 'asistente'), getDashboard);
router.get('/plan-consumo', authorize('contable', 'asistente'), getPlanYConsumo);
router.post('/solicitar-upgrade', authorize('contable'), solicitarUpgrade); // <--- NUEVA RUTA
router.get('/estado-solicitud', authorize('contable'), verEstadoSolicitud);   // <--- NUEVA RUTA

// --- EMPRESAS ---
router.get('/empresas', authorize('contable', 'asistente'), getEmpresas);
router.post('/empresas', authorize('contable'), createEmpresa);
router.put('/empresas/:id', authorize('contable', 'super_admin'), updateEmpresa);

// --- FACTURAS ---
router.get('/facturas', authorize('contable', 'asistente'), getFacturas);
router.put('/facturas/:id', authorize('contable', 'asistente'), updateFactura);
router.delete('/facturas/:id', authorize('contable'), deleteFactura);
router.get('/sugerencia-gasto', authorize('contable', 'asistente'), getSugerenciaGasto);
router.post('/facturas/lote', authorize('contable'), procesarLoteFacturas);
router.post('/facturas/exportar-sheets', authorize('contable'), exportarASheets);

// --- ASISTENTES ---
router.post('/asistentes', authorize('contable'), createAsistente);
router.get('/asistentes', authorize('contable'), getAsistentes);
router.put('/asistentes/:id', authorize('contable'), updateAsistente);
router.get('/asistentes/:id/empresas', authorize('contable'), getAsistenteEmpresas);
router.post('/asistentes/:id/empresas', authorize('contable'), assignEmpresasToAsistente);

module.exports = router;