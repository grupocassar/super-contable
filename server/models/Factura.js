const { getDatabase } = require('../config/database');

class Factura {
  // ========== MÉTODOS DE BÚSQUEDA (LECTURA) ==========

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

  // ========== MÉTODOS DE ESTADÍSTICAS ==========

  static getStatsByAsistenteId(asistenteId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT 
          COUNT(CASE WHEN f.estado IN ('pending', 'pendiente') THEN 1 END) as pendientes,
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

  static getStatsByContableId(contableId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT 
          COUNT(CASE WHEN f.estado IN ('pending', 'pendiente') THEN 1 END) as pendientes,
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

  // ========== MÉTODOS DE ESCRITURA (MODIFICADOS PARA 606) ==========

  static create(facturaData) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      const {
        empresa_id, telegram_user_id, telegram_message_id,
        fecha_factura, rnc, ncf, proveedor,
        monto_servicios, monto_bienes, itbis_facturado,
        itbis_retenido, itbis_proporcionalidad, itbis_costo,
        itbis_adelantar, itbis_percibido, tipo_retencion_isr,
        monto_retencion_isr, isr_percibido, impuesto_selectivo,
        otros_impuestos, propina_legal, tipo_id, tipo_gasto,
        forma_pago, fecha_pago, ncf_modificado,
        total_pagado, estado, confidence_score, drive_url, notas
      } = facturaData;

      const query = `
        INSERT INTO facturas (
          empresa_id, telegram_user_id, telegram_message_id,
          fecha_factura, rnc, ncf, proveedor,
          monto_servicios, monto_bienes, itbis_facturado,
          itbis_retenido, itbis_proporcionalidad, itbis_costo,
          itbis_adelantar, itbis_percibido, tipo_retencion_isr,
          monto_retencion_isr, isr_percibido, impuesto_selectivo,
          otros_impuestos, propina_legal, tipo_id, tipo_gasto,
          forma_pago, fecha_pago, ncf_modificado,
          total_pagado, estado, confidence_score, drive_url, notas
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `;

      const values = [
        empresa_id, telegram_user_id || null, telegram_message_id || null,
        fecha_factura || null, rnc || null, ncf || null, proveedor || null,
        monto_servicios || 0, monto_bienes || 0, itbis_facturado || 0,
        itbis_retenido || 0, itbis_proporcionalidad || 0, itbis_costo || 0,
        itbis_adelantar || 0, itbis_percibido || 0, tipo_retencion_isr || null,
        monto_retencion_isr || 0, isr_percibido || 0, impuesto_selectivo || 0,
        otros_impuestos || 0, propina_legal || 0, tipo_id || null, tipo_gasto || null,
        forma_pago || null, fecha_pago || null, ncf_modificado || null,
        total_pagado || 0, estado || 'pendiente', confidence_score || null, drive_url || null, notas || null
      ];

      db.run(query, values, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...facturaData });
      });
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

      if (fields.length === 0) return resolve();

      values.push(id);
      const query = `UPDATE facturas SET ${fields.join(', ')} WHERE id = ?`;

      db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static approve(id, userId) {
    return this.update(id, { estado: 'aprobada' }, userId);
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