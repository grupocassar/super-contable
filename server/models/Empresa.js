const { getDatabase } = require('../config/database');

class Empresa {
  static findAll() {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.all(
        `SELECT e.*, u.nombre_completo as contable_nombre
         FROM empresas e
         LEFT JOIN users u ON e.contable_id = u.id`,
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
        `SELECT e.*, u.nombre_completo as contable_nombre
         FROM empresas e
         LEFT JOIN users u ON e.contable_id = u.id
         WHERE e.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static findByContableId(contableId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.all(
        'SELECT * FROM empresas WHERE contable_id = ?',
        [contableId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static findByAsistenteId(asistenteId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.all(
        `SELECT DISTINCT e.*
         FROM empresas e
         INNER JOIN asistente_empresas ae ON e.id = ae.empresa_id
         WHERE ae.asistente_id = ?`,
        [asistenteId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static getStats(empresaId) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        `SELECT 
           COUNT(CASE WHEN estado = 'pending' THEN 1 END) as pendientes,
           COUNT(CASE WHEN estado = 'lista' THEN 1 END) as listas,
           COUNT(CASE WHEN estado = 'aprobada' THEN 1 END) as aprobadas
         FROM facturas
         WHERE empresa_id = ?`,
        [empresaId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { pendientes: 0, listas: 0, aprobadas: 0 });
        }
      );
    });
  }

  static create(empresaData) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      // Eliminamos telegram_chat_id de la destructuración
      const { nombre, rnc, contable_id, codigo_corto } = empresaData;

      db.run(
        `INSERT INTO empresas (nombre, rnc, contable_id, codigo_corto)
         VALUES (?, ?, ?, ?)`,
        [nombre, rnc || null, contable_id, codigo_corto],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...empresaData });
        }
      );
    });
  }

  static update(id, updates) {
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

      if (fields.length === 0) {
        return resolve();
      }

      values.push(id);
      const query = `UPDATE empresas SET ${fields.join(', ')} WHERE id = ?`;

      db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.run('DELETE FROM empresas WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = Empresa;