const { runQuery, getOne, getAll } = require('../config/database');

class Factura {
  static async create(data) {
    const {
      empresa_id,
      telegram_user_id = null,
      fecha_factura = null,
      ncf = null,
      rnc = null,
      proveedor = null,
      itbis = null,
      total_pagado = null,
      drive_url,
      estado = 'pending',
      confidence_score = null
    } = data;

    const result = await runQuery(
      `INSERT INTO facturas (
        empresa_id, telegram_user_id, fecha_factura, ncf, rnc, proveedor,
        itbis, total_pagado, drive_url, estado, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empresa_id, telegram_user_id, fecha_factura, ncf, rnc, proveedor,
        itbis, total_pagado, drive_url, estado, confidence_score
      ]
    );

    return { id: result.lastID };
  }

  static async findById(id) {
    const factura = await getOne(
      `SELECT f.*, e.nombre as empresa_nombre, e.contable_id,
              u.nombre_completo as procesado_por_nombre
       FROM facturas f
       LEFT JOIN empresas e ON e.id = f.empresa_id
       LEFT JOIN users u ON u.id = f.procesado_por
       WHERE f.id = ?`,
      [id]
    );

    return factura;
  }

  static async findByEmpresaId(empresaId, filters = {}) {
    let sql = `
      SELECT f.*, e.nombre as empresa_nombre
      FROM facturas f
      LEFT JOIN empresas e ON e.id = f.empresa_id
      WHERE f.empresa_id = ?
    `;
    const params = [empresaId];

    if (filters.estado) {
      sql += ` AND f.estado = ?`;
      params.push(filters.estado);
    }

    if (filters.fecha_desde) {
      sql += ` AND f.fecha_factura >= ?`;
      params.push(filters.fecha_desde);
    }

    if (filters.fecha_hasta) {
      sql += ` AND f.fecha_factura <= ?`;
      params.push(filters.fecha_hasta);
    }

    sql += ` ORDER BY f.created_at DESC`;

    return await getAll(sql, params);
  }

  static async findByContableId(contableId, filters = {}) {
    let sql = `
      SELECT f.*, e.nombre as empresa_nombre, e.codigo_corto
      FROM facturas f
      INNER JOIN empresas e ON e.id = f.empresa_id
      WHERE e.contable_id = ?
    `;
    const params = [contableId];

    if (filters.estado) {
      sql += ` AND f.estado = ?`;
      params.push(filters.estado);
    }

    if (filters.empresa_id) {
      sql += ` AND f.empresa_id = ?`;
      params.push(filters.empresa_id);
    }

    if (filters.fecha_desde) {
      sql += ` AND f.fecha_factura >= ?`;
      params.push(filters.fecha_desde);
    }

    if (filters.fecha_hasta) {
      sql += ` AND f.fecha_factura <= ?`;
      params.push(filters.fecha_hasta);
    }

    sql += ` ORDER BY f.created_at DESC`;

    return await getAll(sql, params);
  }

  static async findByAsistenteId(asistenteId, filters = {}) {
    let sql = `
      SELECT f.*, e.nombre as empresa_nombre, e.codigo_corto
      FROM facturas f
      INNER JOIN empresas e ON e.id = f.empresa_id
      INNER JOIN asistente_empresas ae ON ae.empresa_id = e.id
      WHERE ae.asistente_id = ?
    `;
    const params = [asistenteId];

    if (filters.estado) {
      sql += ` AND f.estado = ?`;
      params.push(filters.estado);
    }

    if (filters.empresa_id) {
      sql += ` AND f.empresa_id = ?`;
      params.push(filters.empresa_id);
    }

    sql += ` ORDER BY f.created_at DESC`;

    return await getAll(sql, params);
  }

  static async update(id, updates, userId = null) {
    const allowedFields = [
      'fecha_factura', 'ncf', 'rnc', 'proveedor', 'itbis', 'total_pagado',
      'estado', 'confidence_score', 'drive_url', 'notas', 'saltada'
    ];

    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    if (userId && updates.estado) {
      fields.push('procesado_por = ?');
      fields.push('fecha_procesado = CURRENT_TIMESTAMP');
      params.push(userId);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE facturas SET ${fields.join(', ')} WHERE id = ?`;

    const result = await runQuery(sql, params);
    return result.changes > 0;
  }

  static async delete(id) {
    const result = await runQuery(
      `DELETE FROM facturas WHERE id = ?`,
      [id]
    );

    return result.changes > 0;
  }

  static async approve(id, userId) {
    return await this.update(id, { estado: 'aprobada' }, userId);
  }

  static async reject(id, userId) {
    return await this.update(id, { estado: 'rechazada' }, userId);
  }

  static async approveMultiple(ids, userId) {
    const promises = ids.map(id => this.approve(id, userId));
    return await Promise.all(promises);
  }

  static async getStatsByContableId(contableId) {
    const stats = await getOne(
      `SELECT
        COUNT(CASE WHEN f.estado = 'pending' THEN 1 END) as pendientes,
        COUNT(CASE WHEN f.estado = 'lista' THEN 1 END) as listas,
        COUNT(CASE WHEN f.estado = 'aprobada' THEN 1 END) as aprobadas,
        COUNT(CASE WHEN f.estado = 'exportada' THEN 1 END) as exportadas,
        COUNT(CASE WHEN f.estado = 'rechazada' THEN 1 END) as rechazadas,
        COUNT(*) as total,
        SUM(f.total_pagado) as monto_total
       FROM facturas f
       INNER JOIN empresas e ON e.id = f.empresa_id
       WHERE e.contable_id = ?`,
      [contableId]
    );

    return stats;
  }

  static async getStatsByAsistenteId(asistenteId) {
    const stats = await getOne(
      `SELECT
        COUNT(CASE WHEN f.estado = 'pending' THEN 1 END) as pendientes,
        COUNT(CASE WHEN f.estado = 'lista' THEN 1 END) as listas,
        COUNT(*) as total
       FROM facturas f
       INNER JOIN empresas e ON e.id = f.empresa_id
       INNER JOIN asistente_empresas ae ON ae.empresa_id = e.id
       WHERE ae.asistente_id = ?`,
      [asistenteId]
    );

    return stats;
  }

  static async findByNCF(ncf, asistenteId = null) {
    let sql = `
      SELECT f.*, e.nombre as empresa_nombre, e.codigo_corto
      FROM facturas f
      INNER JOIN empresas e ON e.id = f.empresa_id
      WHERE f.ncf = ?
    `;
    const params = [ncf];

    if (asistenteId) {
      sql += `
        AND EXISTS (
          SELECT 1 FROM asistente_empresas ae
          WHERE ae.empresa_id = f.empresa_id
          AND ae.asistente_id = ?
        )
      `;
      params.push(asistenteId);
    }

    sql += ` ORDER BY f.created_at DESC`;

    return await getAll(sql, params);
  }
}

module.exports = Factura;
