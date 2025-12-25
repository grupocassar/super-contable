const express = require('express');
const router = express.Router();
const contableController = require('../controllers/contableController');
const { authenticate } = require('../middleware/auth');
const { requireContable } = require('../middleware/roles');

router.use(authenticate);
router.use(requireContable);

router.get('/dashboard', contableController.getDashboard);

router.get('/empresas', contableController.getEmpresas);
router.post('/empresas', contableController.createEmpresa);
router.put('/empresas/:id', contableController.updateEmpresa);

router.get('/facturas', contableController.getFacturas);

router.get('/asistentes', contableController.getAsistentes);
router.post('/asistentes', contableController.createAsistente);

module.exports = router;
