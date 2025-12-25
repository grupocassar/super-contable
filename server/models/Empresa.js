const { runQuery, getOne, getAll } = require('../config/database');

class Empresa {
  static async create({ contable_id, nombre, rnc = null, codigo_corto = null }) {
    const result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto, activa)
       VALUES (?, ?, ?, ?, 1)`,
      [contable_id, nombre, rnc, codigo_corto]
    );

    return { id: result.lastID };
  }

  static async findById(id) {
    const empresa = await getOne(
      `SELECT id, contable_id, nombre, rnc, codigo_corto, activa, created_at, updated_at
       FROM empresas WHERE id = ?`,
      [id]
    );

    return empresa;
  }

  static async findByContableId(contableId, filters = {}) {
    let sql = `SELECT id, contable_id, nombre, rnc, codigo_corto, activa, created_at, updated_at
               FROM empresas WHERE contable_id = ?`;
    const params = [contableId];

    if (filters.activa !== undefined) {
      sql += ` AND activa = ?`;
      params.push(filters.activa ? 1 : 0);
    }

    sql += ` ORDER BY nombre ASC`;

    return await getAll(sql, params);
  }

  static async findByAsistenteId(asistenteId, filters = {}) {
    let sql = `
      SELECT e.id, e.contable_id, e.nombre, e.rnc, e.codigo_corto, e.activa, e.created_at, e.updated_at
      FROM empresas e
      INNER JOIN asistente_empresas ae ON ae.empresa_id = e.id
      WHERE ae.asistente_id = ?
    `;
    const params = [asistenteId];

    if (filters.activa !== undefined) {
      sql += ` AND e.activa = ?`;
      params.push(filters.activa ? 1 : 0);
    }

    sql += ` ORDER BY e.nombre ASC`;

    return await getAll(sql, params);
  }

  static async findAll() {
    return await getAll(
      `SELECT e.id, e.contable_id, e.nombre, e.rnc, e.codigo_corto, e.activa,
              e.created_at, e.updated_at, u.nombre_completo as contable_nombre
       FROM empresas e
       LEFT JOIN users u ON u.id = e.contable_id
       ORDER BY e.nombre ASC`
    );
  }

  static async update(id, updates) {
    const allowedFields = ['nombre', 'rnc', 'codigo_corto', 'activa'];
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

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE empresas SET ${fields.join(', ')} WHERE id = ?`;

    const result = await runQuery(sql, params);
    return result.changes > 0;
  }

  static async delete(id) {
    const result = await runQuery(
      `DELETE FROM empresas WHERE id = ?`,
      [id]
    );

    return result.changes > 0;
  }

  static async assignToAsistente(empresaId, asistenteId) {
    const result = await runQuery(
      `INSERT OR IGNORE INTO asistente_empresas (asistente_id, empresa_id)
       VALUES (?, ?)`,
      [asistenteId, empresaId]
    );

    return result.changes > 0;
  }

  static async unassignFromAsistente(empresaId, asistenteId) {
    const result = await runQuery(
      `DELETE FROM asistente_empresas
       WHERE asistente_id = ? AND empresa_id = ?`,
      [asistenteId, empresaId]
    );

    return result.changes > 0;
  }

  static async getStats(empresaId) {
    const stats = await getOne(
      `SELECT
        COUNT(CASE WHEN estado = 'pending' THEN 1 END) as facturas_pendientes,
        COUNT(CASE WHEN estado = 'lista' THEN 1 END) as facturas_listas,
        COUNT(CASE WHEN estado = 'aprobada' THEN 1 END) as facturas_aprobadas,
        COUNT(*) as total_facturas,
        SUM(total_pagado) as monto_total
       FROM facturas
       WHERE empresa_id = ?`,
      [empresaId]
    );

    return stats;
  }
}

module.exports = Empresa;
