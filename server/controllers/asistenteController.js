const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const { asyncHandler } = require('../middleware/errorHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const asistenteId = req.user.userId;

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const facturaStats = await Factura.getStatsByAsistenteId(asistenteId);

  res.json({
    success: true,
    data: {
      stats: {
        total_empresas: empresas.length,
        facturas: facturaStats
      },
      empresas,
      facturas_recientes: await Factura.findByAsistenteId(asistenteId, {})
    }
  });
});

const getFacturas = asyncHandler(async (req, res) => {
  const asistenteId = req.user.userId;
  const { estado, empresa_id } = req.query;

  const filters = {
    estado,
    empresa_id: empresa_id ? parseInt(empresa_id) : undefined
  };

  const facturas = await Factura.findByAsistenteId(asistenteId, filters);

  res.json({
    success: true,
    data: facturas
  });
});

const updateFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const asistenteId = req.user.userId;
  const updates = req.body;

  const factura = await Factura.findById(id);
  if (!factura) {
    return res.status(404).json({
      success: false,
      message: 'Factura not found'
    });
  }

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const empresaIds = empresas.map(e => e.id);

  if (!empresaIds.includes(factura.empresa_id)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this factura'
    });
  }

  await Factura.update(id, updates, asistenteId);

  const updatedFactura = await Factura.findById(id);

  res.json({
    success: true,
    data: updatedFactura
  });
});

const aprobarFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const asistenteId = req.user.userId;

  const factura = await Factura.findById(id);
  if (!factura) {
    return res.status(404).json({
      success: false,
      message: 'Factura not found'
    });
  }

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const empresaIds = empresas.map(e => e.id);

  if (!empresaIds.includes(factura.empresa_id)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this factura'
    });
  }

  await Factura.approve(id, asistenteId);

  const updatedFactura = await Factura.findById(id);

  res.json({
    success: true,
    data: updatedFactura
  });
});

const aprobarLote = asyncHandler(async (req, res) => {
  const { facturas_ids } = req.body;
  const asistenteId = req.user.userId;

  if (!Array.isArray(facturas_ids) || facturas_ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'facturas_ids must be a non-empty array'
    });
  }

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const empresaIds = empresas.map(e => e.id);

  for (const facturaId of facturas_ids) {
    const factura = await Factura.findById(facturaId);

    if (!factura) {
      continue;
    }

    if (!empresaIds.includes(factura.empresa_id)) {
      continue;
    }

    await Factura.approve(facturaId, asistenteId);
  }

  res.json({
    success: true,
    message: `${facturas_ids.length} facturas processed`
  });
});

const rechazarFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const asistenteId = req.user.userId;

  const factura = await Factura.findById(id);
  if (!factura) {
    return res.status(404).json({
      success: false,
      message: 'Factura not found'
    });
  }

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const empresaIds = empresas.map(e => e.id);

  if (!empresaIds.includes(factura.empresa_id)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this factura'
    });
  }

  await Factura.reject(id, asistenteId);

  const updatedFactura = await Factura.findById(id);

  res.json({
    success: true,
    data: updatedFactura
  });
});

const checkDuplicado = asyncHandler(async (req, res) => {
  const { ncf } = req.query;
  const asistenteId = req.user.userId;

  if (!ncf) {
    return res.status(400).json({
      success: false,
      message: 'NCF is required'
    });
  }

  const duplicados = await Factura.findByNCF(ncf, asistenteId);

  res.json({
    success: true,
    data: duplicados.filter(f => f.ncf === ncf)
  });
});

const desmarcarFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const asistenteId = req.user.userId;

  const factura = await Factura.findById(id);
  if (!factura) {
    return res.status(404).json({
      success: false,
      message: 'Factura not found'
    });
  }

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const empresaIds = empresas.map(e => e.id);

  if (!empresaIds.includes(factura.empresa_id)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this factura'
    });
  }

  if (factura.estado !== 'lista') {
    return res.status(400).json({
      success: false,
      message: 'Only facturas in "lista" state can be unmarked'
    });
  }

  await Factura.update(id, { estado: 'pending' }, asistenteId);

  const updatedFactura = await Factura.findById(id);

  res.json({
    success: true,
    data: updatedFactura
  });
});

module.exports = {
  getDashboard,
  getFacturas,
  updateFactura,
  aprobarFactura,
  aprobarLote,
  rechazarFactura,
  checkDuplicado,
  desmarcarFactura
};
