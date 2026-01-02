const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const { asyncHandler } = require('../middleware/errorHandler');
const { notificarRechazo } = require('../services/telegramService');

const getDashboard = asyncHandler(async (req, res) => {
  const asistenteId = req.user.userId;

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const facturaStats = await Factura.getStatsByAsistenteId(asistenteId);

  // Obtener facturas agrupadas por nivel de confianza
  const todasFacturas = await Factura.findByAsistenteId(asistenteId, {});
  
  const facturasAgrupadas = {
    alta_confianza: todasFacturas.filter(f => 
      f.estado === 'pending' && (f.confidence_score || 0) >= 95
    ),
    media_confianza: todasFacturas.filter(f => 
      f.estado === 'pending' && (f.confidence_score || 0) >= 80 && (f.confidence_score || 0) < 95
    ),
    baja_confianza: todasFacturas.filter(f => 
      f.estado === 'pending' && (f.confidence_score || 0) < 80
    ),
    listas: todasFacturas.filter(f => f.estado === 'lista')
  };

  res.json({
    success: true,
    data: {
      stats: {
        total_empresas: empresas.length,
        facturas: facturaStats
      },
      empresas,
      facturas_agrupadas: facturasAgrupadas,
      facturas_recientes: todasFacturas
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

  // Si se rechazó la factura, notificar al usuario
  if (updates.estado === 'rechazada') {
    try {
      await notificarRechazo(id);
    } catch (error) {
      console.error('Error notificando rechazo:', error);
      // No fallar el request si falla la notificación
    }
  }

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

  // Marcar como "lista", no como "aprobada"
  await Factura.update(id, { estado: 'lista' }, asistenteId);

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

  let aprobadas = 0;
  let errores = 0;

  for (const facturaId of facturas_ids) {
    const factura = await Factura.findById(facturaId);

    if (!factura) {
      errores++;
      continue;
    }

    if (!empresaIds.includes(factura.empresa_id)) {
      errores++;
      continue;
    }

    // Solo aprobar si está en estado "lista"
    if (factura.estado === 'lista') {
      await Factura.approve(facturaId, asistenteId);
      aprobadas++;
    }
  }

  res.json({
    success: true,
    message: `${aprobadas} facturas aprobadas`,
    data: {
      aprobadas,
      errores,
      total: facturas_ids.length
    }
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

// NUEVO: Check duplicados
const checkDuplicado = asyncHandler(async (req, res) => {
  const { ncf } = req.query;
  const asistenteId = req.user.userId;

  if (!ncf) {
    return res.json({ success: true, data: [] });
  }

  const empresas = await Empresa.findByAsistenteId(asistenteId);
  const empresaIds = empresas.map(e => e.id);

  // Buscar facturas con mismo NCF en empresas del asistente
  const todasFacturas = await Factura.findByAsistenteId(asistenteId, {});
  const duplicados = todasFacturas.filter(f => 
    f.ncf && f.ncf.toLowerCase() === ncf.toLowerCase()
  );

  res.json({
    success: true,
    data: duplicados
  });
});

module.exports = {
  getDashboard,
  getFacturas,
  updateFactura,
  aprobarFactura,
  aprobarLote,
  rechazarFactura,
  checkDuplicado
};