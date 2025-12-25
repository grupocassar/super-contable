const User = require('../models/User');
const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const { asyncHandler } = require('../middleware/errorHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const contables = await User.findAll({ rol: 'contable' });
  const asistentes = await User.findAll({ rol: 'asistente' });
  const empresas = await Empresa.findAll();

  const facturaStats = await Factura.getStatsByContableId(null);

  res.json({
    success: true,
    data: {
      stats: {
        total_contables: contables.length,
        total_asistentes: asistentes.length,
        total_empresas: empresas.length,
        facturas: facturaStats
      },
      contables,
      recent_activity: []
    }
  });
});

const getContables = asyncHandler(async (req, res) => {
  const contables = await User.findAll({ rol: 'contable' });

  const contablesWithStats = await Promise.all(
    contables.map(async (contable) => {
      const stats = await User.getContableStats(contable.id);
      return {
        ...contable,
        stats
      };
    })
  );

  res.json({
    success: true,
    data: contablesWithStats
  });
});

const createContable = asyncHandler(async (req, res) => {
  const { email, password, nombre_completo } = req.body;

  if (!email || !password || !nombre_completo) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, and nombre_completo are required'
    });
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'Email already exists'
    });
  }

  const result = await User.create({
    email,
    password,
    nombre_completo,
    rol: 'contable'
  });

  const newUser = await User.findById(result.id);

  res.status(201).json({
    success: true,
    data: newUser
  });
});

const updateContable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const user = await User.findById(id);
  if (!user || user.rol !== 'contable') {
    return res.status(404).json({
      success: false,
      message: 'Contable not found'
    });
  }

  await User.update(id, updates);

  const updatedUser = await User.findById(id);

  res.json({
    success: true,
    data: updatedUser
  });
});

const deleteContable = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user || user.rol !== 'contable') {
    return res.status(404).json({
      success: false,
      message: 'Contable not found'
    });
  }

  await User.delete(id);

  res.json({
    success: true,
    message: 'Contable deleted successfully'
  });
});

module.exports = {
  getDashboard,
  getContables,
  createContable,
  updateContable,
  deleteContable
};
