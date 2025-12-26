const User = require('../models/User');
const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Función auxiliar para generar un código corto único basado en el nombre
 * Ejemplo: "Supermercado Pinos" -> SUPE123
 */
function generarCodigoAutomatico(nombre) {
  const prefijo = nombre
    .toUpperCase()
    .normalize("NFD")               // Descompone caracteres con acentos
    .replace(/[\u0300-\u036f]/g, "") // Elimina los acentos
    .replace(/[^A-Z]/g, "")          // Elimina todo lo que no sean letras
    .substring(0, 4);                // Toma las primeras 4 letras

  const sufijo = Math.floor(100 + Math.random() * 900); // Agrega 3 números aleatorios
  return `${prefijo}${sufijo}`;
}

const getDashboard = asyncHandler(async (req, res) => {
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;

  const empresas = await Empresa.findByContableId(contableId);
  const asistentes = await User.findAll({ contable_id: contableId, rol: 'asistente' });
  const facturaStats = await Factura.getStatsByContableId(contableId);

  res.json({
    success: true,
    data: {
      stats: {
        total_empresas: empresas.length,
        total_asistentes: asistentes.length,
        facturas: facturaStats
      },
      empresas_recientes: empresas.slice(0, 5),
      facturas_recientes: await Factura.findByContableId(contableId, { limit: 10 })
    }
  });
});

const getEmpresas = asyncHandler(async (req, res) => {
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;

  const empresas = await Empresa.findByContableId(contableId);

  const empresasWithStats = await Promise.all(
    empresas.map(async (empresa) => {
      const stats = await Empresa.getStats(empresa.id);
      return {
        ...empresa,
        stats
      };
    })
  );

  res.json({
    success: true,
    data: empresasWithStats
  });
});

const createEmpresa = asyncHandler(async (req, res) => {
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const { nombre, rnc } = req.body; // Ya no necesitamos recibir codigo_corto del frontend

  if (!nombre) {
    return res.status(400).json({
      success: false,
      message: 'El nombre es obligatorio'
    });
  }

  // --- LÓGICA AUTOMÁTICA ---
  // Generamos el código aquí para que el contable no tenga que inventarlo
  const codigo_corto = generarCodigoAutomatico(nombre);

  const result = await Empresa.create({
    contable_id: contableId,
    nombre,
    rnc,
    codigo_corto // Se guarda el código generado automáticamente
  });

  const newEmpresa = await Empresa.findById(result.id);

  res.status(201).json({
    success: true,
    data: newEmpresa
  });
});

const updateEmpresa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const updates = req.body;

  const empresa = await Empresa.findById(id);
  if (!empresa) {
    return res.status(404).json({
      success: false,
      message: 'Empresa no encontrada'
    });
  }

  if (empresa.contable_id !== contableId && req.user.rol !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado'
    });
  }

  await Empresa.update(id, updates);

  const updatedEmpresa = await Empresa.findById(id);

  res.json({
    success: true,
    data: updatedEmpresa
  });
});

const getFacturas = asyncHandler(async (req, res) => {
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const { estado, empresa_id, fecha_desde, fecha_hasta } = req.query;

  const filters = {
    estado,
    empresa_id: empresa_id ? parseInt(empresa_id) : undefined,
    fecha_desde,
    fecha_hasta
  };

  const facturas = await Factura.findByContableId(contableId, filters);

  res.json({
    success: true,
    data: facturas
  });
});

const createAsistente = asyncHandler(async (req, res) => {
  const contableId = req.user.userId;
  const { email, password, nombre_completo } = req.body;

  if (!email || !password || !nombre_completo) {
    return res.status(400).json({
      success: false,
      message: 'Email, password y nombre_completo son requeridos'
    });
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'El email ya existe'
    });
  }

  const result = await User.create({
    email,
    password,
    nombre_completo,
    rol: 'asistente',
    contable_id: contableId
  });

  const newUser = await User.findById(result.id);

  res.status(201).json({
    success: true,
    data: newUser
  });
});

const getAsistentes = asyncHandler(async (req, res) => {
  const contableId = req.user.userId;

  const asistentes = await User.findAll({ contable_id: contableId, rol: 'asistente' });

  res.json({
    success: true,
    data: asistentes
  });
});

module.exports = {
  getDashboard,
  getEmpresas,
  createEmpresa,
  updateEmpresa,
  getFacturas,
  createAsistente,
  getAsistentes
};