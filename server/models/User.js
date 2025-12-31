const { getDatabase } = require('../config/database');

class User {
  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      let query = 'SELECT * FROM users WHERE 1=1';
      const params = [];

      // Sincronización: Usamos 'role' para coincidir con el Schema
      if (filters.role || filters.rol) {
        query += ' AND role = ?';
        params.push(filters.role || filters.rol);
      }

      if (filters.contable_id) {
        query += ' AND contable_id = ?';
        params.push(filters.contable_id);
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  static create(userData) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      
      // Sincronización con Schema: email, password, role, contable_id
      const { email, password, password_hash, role, rol, contable_id } = userData;
      
      const finalPassword = password || password_hash;
      const finalRole = role || rol || 'contable';

      if (!finalPassword) {
        return reject(new Error('La contraseña es obligatoria'));
      }

      db.run(
        `INSERT INTO users (email, password, role, contable_id)
          VALUES (?, ?, ?, ?)`,
        [email, finalPassword, finalRole, contable_id || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...userData });
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
          // Mapeo automático de rol -> role si viene del frontend viejo
          const dbKey = key === 'rol' ? 'role' : key;
          fields.push(`${dbKey} = ?`);
          values.push(updates[key]);
        }
      });

      if (fields.length === 0) {
        return resolve();
      }

      values.push(id);
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

      db.run(query, values, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      const db = getDatabase();
      db.run('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = User;