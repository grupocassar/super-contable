const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/roles');

router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/dashboard', adminController.getDashboard);

router.get('/contables', adminController.getContables);
router.post('/contables', adminController.createContable);
router.put('/contables/:id', adminController.updateContable);
router.delete('/contables/:id', adminController.deleteContable);

module.exports = router;
