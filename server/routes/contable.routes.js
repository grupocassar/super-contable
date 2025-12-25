const express = require('express');
const router = express.Router();
const contableController = require('../controllers/contableController');

router.get('/dashboard', contableController.getDashboard);
router.get('/empresas', contableController.getEmpresas);
router.post('/empresas', contableController.createEmpresa);
router.put('/empresas/:id', contableController.updateEmpresa);
router.get('/facturas', contableController.getFacturas);
router.post('/asistentes', contableController.createAsistente);
router.get('/asistentes', contableController.getAsistentes);

module.exports = router;