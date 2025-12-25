const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getFacturas,
  updateFactura,
  aprobarLote,
  checkDuplicado
} = require('../controllers/asistenteController');

router.get('/dashboard', getDashboard);
router.get('/facturas', getFacturas);
router.get('/facturas/check-duplicado', checkDuplicado);
router.put('/facturas/:id', updateFactura);
router.post('/aprobar-lote', aprobarLote);

module.exports = router;