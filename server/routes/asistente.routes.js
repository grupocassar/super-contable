const express = require('express');
const router = express.Router();
const asistenteController = require('../controllers/asistenteController');
const { authenticate } = require('../middleware/auth');
const { requireAsistente } = require('../middleware/roles');

router.use(authenticate);
router.use(requireAsistente);

router.get('/dashboard', asistenteController.getDashboard);

router.get('/facturas', asistenteController.getFacturas);
router.get('/facturas/check-duplicado', asistenteController.checkDuplicado);
router.put('/facturas/:id', asistenteController.updateFactura);

router.post('/facturas/:id/aprobar', asistenteController.aprobarFactura);
router.post('/facturas/:id/rechazar', asistenteController.rechazarFactura);
router.post('/facturas/:id/desmarcar', asistenteController.desmarcarFactura);
router.post('/aprobar-lote', asistenteController.aprobarLote);

module.exports = router;
