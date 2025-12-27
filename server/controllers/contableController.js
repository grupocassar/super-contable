const User = require('../models/User');
const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const bcrypt = require('bcryptjs'); 
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

const updateFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const factura = await Factura.findById(id);
  if (!factura) {
    return res.status(404).json({ success: false, message: 'Factura no encontrada' });
  }

  await Factura.update(id, updates);

  res.json({ 
    success: true, 
    message: 'Factura actualizada correctamente',
    data: await Factura.findById(id)
  });
});

const deleteFactura = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contableId = req.user.rol === 'contable' ? req.user.userId : req.user.contableId;
  const db = getDatabase();

  const factura = db.prepare(`
    SELECT f.* FROM facturas f
    JOIN empresas e ON f.empresa_id = e.id
    WHERE f.id = ? AND e.contable_id = ?
  `).get(id, contableId);

  if (!factura) {
    return res.status(404).json({ 
      success: false, 
      message: 'Factura no encontrada o no tienes permiso para eliminarla' 
    });
  }

  db.prepare('DELETE FROM facturas WHERE id = ?').run(id);

  res.json({
    success: true,
    message: 'Factura eliminada correctamente',
    data: { id: parseInt(id) }
  });
});

const getSugerenciaGasto = asyncHandler(async (req, res) => {
  const { proveedor } = req.query;
  if (!proveedor) {
    return res.status(400).json({ success: false, message: 'El nombre del proveedor es requerido' });
  }

  const db = getDatabase();
  const sugerencia = db.prepare(`
    SELECT tipo_gasto, COUNT(*) as veces 
    FROM facturas 
    WHERE proveedor = ? 
      AND tipo_gasto IS NOT NULL 
      AND tipo_gasto != ''
    GROUP BY tipo_gasto 
    ORDER BY veces DESC 
    LIMIT 1
  `).get(proveedor);

  res.json({
    success: true,
    data: sugerencia || null
  });
});

/**
 * ✅ CORREGIDO: Procesar Lote de Facturas
 * Cambia el estado a 'exportada' que sí es un estado válido en la BD.
 */
const procesarLoteFacturas = asyncHandler(async (req, res) => {
  const { ids } = req.body; 
  const db = getDatabase();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Se requiere una lista de IDs' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // CORRECCIÓN: Usar estado 'exportada' en lugar de 'procesada'
    const stmt = db.prepare("UPDATE facturas SET estado = 'exportada' WHERE id = ?");
    
    ids.forEach(id => {
      stmt.run(id);
    });
    
    stmt.finalize();
    
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error al procesar lote' });
      res.json({ success: true, message: `${ids.length} facturas marcadas como exportadas` });
    });
  });
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
  
  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    updates.password_hash = await bcrypt.hash(password, salt);
  }

  await User.update(id, updates);
  res.json({ success: true, data: await User.findById(id) });
});

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
  updateFactura,
  deleteFactura,
  getSugerenciaGasto,
  procesarLoteFacturas,
  createAsistente,
  getAsistentes,
  updateAsistente,
  getAsistenteEmpresas,
  assignEmpresasToAsistente
};