const User = require('../models/User');
const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const bcrypt = require('bcryptjs'); // IMPORTANTE: Para que el login funcione
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');

/**
 * Función auxiliar para generar un código corto único basado en el nombre
 */
function generarCodigoAutomatico(nombre) {
  const prefijo = nombre
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .substring(0, 4);

  const sufijo = Math.floor(100 + Math.random() * 900);
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
      return { ...empresa, stats };
    })
  );
  res.json({ success: true, data: empresasWithStats });
});

const createEmpresa = asyncHandler(async (req, res) => {
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const { nombre, rnc } = req.body;
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
  const codigo_corto = generarCodigoAutomatico(nombre);
  const result = await Empresa.create({ contable_id: contableId, nombre, rnc, codigo_corto });
  const newEmpresa = await Empresa.findById(result.id);
  res.status(201).json({ success: true, data: newEmpresa });
});

const updateEmpresa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const empresa = await Empresa.findById(id);
  if (!empresa) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
  if (empresa.contable_id !== contableId && req.user.rol !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Acceso denegado' });
  }
  await Empresa.update(id, req.body);
  res.json({ success: true, data: await Empresa.findById(id) });
});

const getFacturas = asyncHandler(async (req, res) => {
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const { estado, empresa_id } = req.query;
  const facturas = await Factura.findByContableId(contableId, { estado, empresa_id: empresa_id ? parseInt(empresa_id) : undefined });
  res.json({ success: true, data: facturas });
});

// --- GESTIÓN DE ASISTENTES ---

const createAsistente = asyncHandler(async (req, res) => {
  const contableId = req.user.userId;
  const { email, password, nombre_completo } = req.body;

  if (!email || !password || !nombre_completo) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  const existingUser = await User.findByEmail(email);
  if (existingUser) return res.status(409).json({ success: false, message: 'El email ya existe' });

  // ENCRIPTACIÓN DE CONTRASEÑA
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const result = await User.create({ 
    email, 
    password_hash, 
    nombre_completo, 
    rol: 'asistente', 
    contable_id: contableId 
  });
  
  res.status(201).json({ success: true, data: await User.findById(result.id) });
});

const getAsistentes = asyncHandler(async (req, res) => {
  const contableId = req.user.userId;
  const asistentes = await User.findAll({ contable_id: contableId, rol: 'asistente' });
  res.json({ success: true, data: asistentes });
});

const updateAsistente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contableId = req.user.userId;
  const { email, password, nombre_completo } = req.body;

  const asistente = await User.findById(id);
  if (!asistente) return res.status(404).json({ success: false, message: 'Asistente no encontrado' });

  if (asistente.contable_id !== contableId) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para editar este asistente' });
  }

  const updates = { email, nombre_completo };
  
  // SI SE ESCRIBIÓ UNA CONTRASEÑA, SE ENCRIPTA
  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    updates.password_hash = await bcrypt.hash(password, salt);
  }

  await User.update(id, updates);
  res.json({ success: true, data: await User.findById(id) });
});

/**
 * Obtiene las IDs de las empresas asignadas a un asistente
 */
const getAsistenteEmpresas = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();

  db.all(
    'SELECT empresa_id FROM asistente_empresas WHERE asistente_id = ?',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, data: rows.map(r => r.empresa_id) });
    }
  );
});

/**
 * Asigna/Actualiza las empresas de un asistente
 */
const assignEmpresasToAsistente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { empresasIds } = req.body;
  const db = getDatabase();

  if (!Array.isArray(empresasIds)) {
    return res.status(400).json({ success: false, message: 'Se requiere un array de IDs de empresas' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM asistente_empresas WHERE asistente_id = ?', [id]);
    const stmt = db.prepare('INSERT INTO asistente_empresas (asistente_id, empresa_id, created_at) VALUES (?, ?, ?)');
    const now = new Date().toISOString();
    empresasIds.forEach(empresaId => {
      stmt.run(id, empresaId, now);
    });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error en la transacción' });
      res.json({ success: true, message: 'Asignaciones actualizadas correctamente' });
    });
  });
});

module.exports = {
  getDashboard,
  getEmpresas,
  createEmpresa,
  updateEmpresa,
  getFacturas,
  createAsistente,
  getAsistentes,
  updateAsistente,
  getAsistenteEmpresas,
  assignEmpresasToAsistente
};