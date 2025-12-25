const { runQuery, getOne, getAll } = require('../config/database');
const bcrypt = require('bcryptjs');
const { config } = require('../config/env');

class User {
  static async create({ email, password, nombre_completo, rol, contable_id = null }) {
    const password_hash = await bcrypt.hash(password, config.bcrypt.rounds);

    const result = await runQuery(
      `INSERT INTO users (email, password_hash, nombre_completo, rol, contable_id, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [email, password_hash, nombre_completo, rol, contable_id]
    );

    return { id: result.lastID };
  }

  static async findById(id) {
    const user = await getOne(
      `SELECT id, email, nombre_completo, rol, contable_id, activo, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );

    return user;
  }

  static async findByEmail(email) {
    const user = await getOne(
      `SELECT id, email, password_hash, nombre_completo, rol, contable_id, activo
       FROM users WHERE email = ?`,
      [email]
    );

    return user;
  }

  static async findAll(filters = {}) {
    let sql = `SELECT id, email, nombre_completo, rol, contable_id, activo, created_at, updated_at
               FROM users WHERE 1=1`;
    const params = [];

    if (filters.rol) {
      sql += ` AND rol = ?`;
      params.push(filters.rol);
    }

    if (filters.contable_id) {
      sql += ` AND contable_id = ?`;
      params.push(filters.contable_id);
    }

    if (filters.activo !== undefined) {
      sql += ` AND activo = ?`;
      params.push(filters.activo ? 1 : 0);
    }

    sql += ` ORDER BY created_at DESC`;

    return await getAll(sql, params);
  }

  static async update(id, updates) {
    const allowedFields = ['email', 'nombre_completo', 'rol', 'contable_id', 'activo'];
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

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

    const result = await runQuery(sql, params);
    return result.changes > 0;
  }

  static async updatePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, config.bcrypt.rounds);

    const result = await runQuery(
      `UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [password_hash, id]
    );

    return result.changes > 0;
  }

  static async delete(id) {
    const result = await runQuery(
      `DELETE FROM users WHERE id = ?`,
      [id]
    );

    return result.changes > 0;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async getContableStats(contableId) {
    const stats = await getOne(
      `SELECT
        COUNT(DISTINCT e.id) as total_empresas,
        COUNT(DISTINCT u.id) as total_asistentes,
        COUNT(f.id) as total_facturas
       FROM users
       LEFT JOIN empresas e ON e.contable_id = users.id
       LEFT JOIN users u ON u.contable_id = users.id AND u.rol = 'asistente'
       LEFT JOIN facturas f ON f.empresa_id = e.id
       WHERE users.id = ?`,
      [contableId]
    );

    return stats;
  }
}

module.exports = User;
