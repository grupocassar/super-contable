const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Dashboard general
router.get('/dashboard', adminController.getAdminDashboard);

// Gestión de Contables
router.get('/contables', adminController.getContables);
router.post('/contables', adminController.createContable);
router.put('/contables/:id', adminController.updateContable);
router.put('/contables/:id/plan', adminController.cambiarPlanContable); 
router.delete('/contables/:id', adminController.deleteContable);

// Gestión de solicitudes de Upgrade (NUEVO)
router.get('/solicitudes', adminController.getSolicitudesPendientes);
router.put('/solicitudes/:id/aprobar', adminController.aprobarSolicitud);
router.put('/solicitudes/:id/rechazar', adminController.rechazarSolicitud);

module.exports = router;