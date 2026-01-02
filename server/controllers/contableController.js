const User = require('../models/User');
const Empresa = require('../models/Empresa');
const Factura = require('../models/Factura');
const ContablePlan = require('../models/ContablePlan'); // <--- NUEVO IMPORT
const bcrypt = require('bcryptjs'); 
const { google } = require('googleapis');
const { asyncHandler } = require('../middleware/errorHandler');
const { getDatabase } = require('../config/database');
const googleSheetsService = require('../services/googleSheetsService');

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
  // Sincronización: req.user.role
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
  const empresas = await Empresa.findByContableId(contableId);
  // Sincronización: role: 'asistente'
  const asistentes = await User.findAll({ contable_id: contableId, role: 'asistente' });
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

/**
 * GET /api/contable/plan-consumo
 * Retorna la información del plan y el uso actual para el widget
 */
const getPlanYConsumo = asyncHandler(async (req, res) => {
  // Usamos la misma lógica que en getDashboard para obtener el ID del dueño de la cuenta
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
  
  const datos = await ContablePlan.getPlanYConsumo(contableId);
  
  res.json({
    success: true,
    data: datos
  });
});

const getEmpresas = asyncHandler(async (req, res) => {
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
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
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
  const { nombre, rnc } = req.body;
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
  const codigo_corto = generarCodigoAutomatico(nombre);
  const result = await Empresa.create({ contable_id: contableId, nombre, rnc, codigo_corto });
  const newEmpresa = await Empresa.findById(result.id);
  res.status(201).json({ success: true, data: newEmpresa });
});

const updateEmpresa = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
  const empresa = await Empresa.findById(id);
  if (!empresa) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
  if (empresa.contable_id !== contableId && req.user.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Acceso denegado' });
  }
  await Empresa.update(id, req.body);
  res.json({ success: true, data: await Empresa.findById(id) });
});

const getFacturas = asyncHandler(async (req, res) => {
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
  const { estado, empresa_id } = req.query;
  // Esto invoca al Modelo Factura que debe hacer SELECT * para traer los 23 campos
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
  const contableId = req.user.role === 'contable' ? req.user.userId : req.user.contableId;
  const db = getDatabase();

  // Cambiado a callback de DB para evitar problemas de sincronización en delete directo
  db.get(`
    SELECT f.id FROM facturas f
    JOIN empresas e ON f.empresa_id = e.id
    WHERE f.id = ? AND e.contable_id = ?
  `, [id, contableId], (err, factura) => {
    if (!factura) {
        return res.status(404).json({ 
          success: false, 
          message: 'Factura no encontrada o no tienes permiso para eliminarla' 
        });
    }
    db.run('DELETE FROM facturas WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al eliminar' });
        res.json({
            success: true,
            message: 'Factura eliminada correctamente',
            data: { id: parseInt(id) }
        });
    });
  });
});

const getSugerenciaGasto = asyncHandler(async (req, res) => {
  const { proveedor } = req.query;
  if (!proveedor) {
    return res.status(400).json({ success: false, message: 'El nombre del proveedor es requerido' });
  }

  const db = getDatabase();
  db.get(`
    SELECT tipo_gasto, COUNT(*) as veces 
    FROM facturas 
    WHERE proveedor = ? 
      AND tipo_gasto IS NOT NULL 
      AND tipo_gasto != ''
    GROUP BY tipo_gasto 
    ORDER BY veces DESC 
    LIMIT 1
  `, [proveedor], (err, sugerencia) => {
      res.json({
        success: true,
        data: sugerencia || null
      });
  });
});

const procesarLoteFacturas = asyncHandler(async (req, res) => {
  const { ids } = req.body; 
  const db = getDatabase();

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Se requiere un lista de IDs' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare("UPDATE facturas SET estado = 'exportada' WHERE id = ?");
    ids.forEach(id => { stmt.run(id); });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error al procesar lote' });
      res.json({ success: true, message: `${ids.length} facturas marcadas como exportadas` });
    });
  });
});

const exportarASheets = asyncHandler(async (req, res) => {
    const { empresa_nombre, periodo_mes, periodo_anio, columnas, facturas } = req.body;
    const userId = req.user.userId;

    if (!facturas || facturas.length === 0) {
        return res.status(400).json({ success: false, message: 'No hay datos para exportar' });
    }

    const user = await User.findById(userId);
    if (!user || !user.drive_refresh_token) {
        return res.status(401).json({ 
            success: false, 
            error: 'auth_required',
            message: 'Debes conectar tu cuenta de Google Drive primero.' 
        });
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL
        );

        oauth2Client.setCredentials({
            refresh_token: user.drive_refresh_token,
            access_token: user.drive_access_token
        });

        await oauth2Client.getAccessToken();

        const spreadsheetName = `Super Contable - ${empresa_nombre || 'Todas las Empresas'}`;
        const mesNombre = new Date(2000, parseInt(periodo_mes) - 1, 1).toLocaleString('es', { month: 'short' });
        const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
        const sheetName = `${mesCapitalizado} ${periodo_anio}`;

        // ALINEACIÓN 606: Mapeo de columnas corregido para soportar los nuevos campos
        const headerMap = {
            'fecha_factura': 'Fecha',
            'empresa_nombre': 'Empresa',
            'rnc': 'RNC',
            'ncf': 'NCF',
            'tipo_ncf': 'Tipo',
            'proveedor': 'Proveedor',
            'tipo_gasto': 'Tipo Gasto',
            'forma_pago': 'Forma Pago',
            'itbis': 'ITBIS',             // Compatibilidad legacy
            'itbis_facturado': 'ITBIS',   // Nuevo esquema
            'total_pagado': 'Total',
            'drive_url': 'Link Factura'
        };
        const headerRow = columnas.map(col => headerMap[col] || col);

        const dataRows = facturas.map(f => {
            return columnas.map(col => {
                let val = f[col];
                // Manejo de valores nulos o undefined
                if (val === null || val === undefined) return '';
                return String(val);
            });
        });

        const sheetInfo = await googleSheetsService.getOrCreateSpreadsheet(oauth2Client, spreadsheetName);
        await googleSheetsService.writeToSheet(oauth2Client, sheetInfo.id, sheetName, headerRow, dataRows);

        res.json({
            success: true,
            data: {
                spreadsheet_url: sheetInfo.url,
                sheet_name: sheetName,
                mensaje: 'Exportado correctamente a Google Sheets'
            }
        });

    } catch (error) {
        console.error('Error exportando a Sheets:', error);
        res.status(500).json({ success: false, message: 'Error técnico al exportar: ' + error.message });
    }
});

// --- GESTIÓN DE ASISTENTES ---

const createAsistente = asyncHandler(async (req, res) => {
  const contableId = req.user.userId;
  const { email, password, nombre_completo } = req.body;
  if (!email || !password || !nombre_completo) return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  
  const existingUser = await User.findByEmail(email);
  if (existingUser) return res.status(409).json({ success: false, message: 'El email ya existe' });
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  // Sincronización: password en lugar de password_hash, role en lugar de rol
  const result = await User.create({ 
    email, 
    password: hashedPassword, 
    nombre_completo, 
    role: 'asistente', 
    contable_id: contableId 
  });
  
  res.status(201).json({ success: true, data: await User.findById(result.id) });
});

const getAsistentes = asyncHandler(async (req, res) => {
  const contableId = req.user.userId;
  // Sincronización: role: 'asistente'
  const asistentes = await User.findAll({ contable_id: contableId, role: 'asistente' });
  res.json({ success: true, data: asistentes });
});

const updateAsistente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const contableId = req.user.userId;
  const { email, password, nombre_completo } = req.body;
  const asistente = await User.findById(id);
  
  if (!asistente) return res.status(404).json({ success: false, message: 'Asistente no encontrado' });
  if (asistente.contable_id !== contableId) return res.status(403).json({ success: false, message: 'No tienes permiso para editar este asistente' });
  
  const updates = { email, nombre_completo };
  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(password, salt);
  }
  
  await User.update(id, updates);
  res.json({ success: true, data: await User.findById(id) });
});

const getAsistenteEmpresas = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  db.all('SELECT empresa_id FROM asistente_empresas WHERE asistente_id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: rows.map(r => r.empresa_id) });
  });
});

const assignEmpresasToAsistente = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { empresasIds } = req.body;
  const db = getDatabase();
  if (!Array.isArray(empresasIds)) return res.status(400).json({ success: false, message: 'Se requiere un array de IDs de empresas' });
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM asistente_empresas WHERE asistente_id = ?', [id]);
    const stmt = db.prepare('INSERT INTO asistente_empresas (asistente_id, empresa_id, created_at) VALUES (?, ?, ?)');
    const now = new Date().toISOString();
    empresasIds.forEach(empresaId => { stmt.run(id, empresaId, now); });
    stmt.finalize();
    db.run('COMMIT', (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error en la transacción' });
      res.json({ success: true, message: 'Asignaciones actualizadas correctamente' });
    });
  });
});

module.exports = {
  getDashboard,
  getPlanYConsumo, // <--- NUEVO EXPORT
  getEmpresas,
  createEmpresa,
  updateEmpresa,
  getFacturas,
  updateFactura,
  deleteFactura,
  getSugerenciaGasto,
  procesarLoteFacturas,
  exportarASheets,
  createAsistente,
  getAsistentes,
  updateAsistente,
  getAsistenteEmpresas,
  assignEmpresasToAsistente
};