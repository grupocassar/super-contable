const { getDatabase } = require('../config/database');

class Factura {
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.all(
        `SELECT f.*, e.nombre as empresa_nombre
         FROM facturas f
         LEFT JOIN empresas e ON f.empresa_id = e.id
         ORDER BY f.created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT f.*, e.nombre as empresa_nombre
         FROM facturas f
         LEFT JOIN empresas e ON f.empresa_id = e.id
         WHERE f.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static findByNCF(ncf) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.all(
        `SELECT f.*, e.nombre as empresa_nombre
         FROM facturas f
         LEFT JOIN empresas e ON f.empresa_id = e.id
         WHERE f.ncf = ?`,
        [ncf],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static findByAsistenteId(asistenteId, filters = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      let query = `
        SELECT f.*, e.nombre as empresa_nombre
        FROM facturas f
        INNER JOIN empresas e ON f.empresa_id = e.id
        INNER JOIN asistente_empresas ae ON e.id = ae.empresa_id
        WHERE ae.asistente_id = ?
      `;
      const params = [asistenteId];

      if (filters.estado) {
        query += ' AND f.estado = ?';
        params.push(filters.estado);
      }

      if (filters.empresa_id) {
        query += ' AND f.empresa_id = ?';
        params.push(filters.empresa_id);
      }

      query += ' ORDER BY f.created_at DESC';

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  static getStatsByAsistenteId(asistenteId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT 
          COUNT(CASE WHEN f.estado = 'pending' THEN 1 END) as pendientes,
          COUNT(CASE WHEN f.estado = 'lista' THEN 1 END) as listas,
          COUNT(CASE WHEN f.estado = 'aprobada' THEN 1 END) as aprobadas
         FROM facturas f
         INNER JOIN empresas e ON f.empresa_id = e.id
         INNER JOIN asistente_empresas ae ON e.id = ae.empresa_id
         WHERE ae.asistente_id = ?`,
        [asistenteId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { pendientes: 0, listas: 0, aprobadas: 0 });
        }
      );
    });
  }

  // --- NUEVOS MÉTODOS PARA EL CONTABLE ---

  static findByContableId(contableId, filters = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      let query = `
        SELECT f.*, e.nombre as empresa_nombre
        FROM facturas f
        INNER JOIN empresas e ON f.empresa_id = e.id
        WHERE e.contable_id = ?
      `;
      const params = [contableId];

      if (filters.estado) {
        query += ' AND f.estado = ?';
        params.push(filters.estado);
      }

      if (filters.empresa_id) {
        query += ' AND f.empresa_id = ?';
        params.push(filters.empresa_id);
      }

      query += ' ORDER BY f.created_at DESC';

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  static getStatsByContableId(contableId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT 
          COUNT(CASE WHEN f.estado = 'pending' THEN 1 END) as pendientes,
          COUNT(CASE WHEN f.estado = 'lista' THEN 1 END) as listas,
          COUNT(CASE WHEN f.estado = 'aprobada' THEN 1 END) as aprobadas,
          COUNT(CASE WHEN f.estado = 'rechazada' THEN 1 END) as rechazadas
         FROM facturas f
         INNER JOIN empresas e ON f.empresa_id = e.id
         WHERE e.contable_id = ?`,
        [contableId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { pendientes: 0, listas: 0, aprobadas: 0, rechazadas: 0 });
        }
      );
    });
  }

  // --- MÉTODOS DE ESCRITURA ---

  static create(facturaData) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const {
        empresa_id,
        telegram_message_id,
        fecha_factura,
        ncf,
        rnc,
        proveedor,
        itbis,
        total_pagado,
        confidence_score,
        drive_url,
        estado
      } = facturaData;

      db.run(
        `INSERT INTO facturas (
          empresa_id, telegram_message_id, fecha_factura, ncf, rnc,
          proveedor, itbis, total_pagado, confidence_score, drive_url, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresa_id,
          telegram_message_id || null,
          fecha_factura || null,
          ncf || null,
          rnc || null,
          proveedor || null,
          itbis || null,
          total_pagado || null,
          confidence_score || null,
          drive_url || null,
          estado || 'pending'
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...facturaData });
        }
      );
    });
  }

  static update(id, updates, userId = null) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      const fields = [];
      const values = [];

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });

      if (userId) {
        fields.push('updated_by = ?');
        values.push(userId);
      }

      if (fields.length === 0) {
        return resolve();
      }

      values.push(id);
      const query = `UPDATE facturas SET ${fields.join(', ')} WHERE id = ?`;

      db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static approve(id, userId) {
    return this.update(id, { 
      estado: 'aprobada',
      approved_at: new Date().toISOString(),
      approved_by: userId
    }, userId);
  }

  static reject(id, userId) {
    return this.update(id, { estado: 'rechazada' }, userId);
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.run('DELETE FROM facturas WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = Factura;