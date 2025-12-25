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

      if (filters.rol) {
        query += ' AND rol = ?';
        params.push(filters.rol);
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
      const { email, password_hash, nombre_completo, rol, contable_id } = userData;

      db.run(
        `INSERT INTO users (email, password_hash, nombre_completo, rol, contable_id)
         VALUES (?, ?, ?, ?, ?)`,
        [email, password_hash, nombre_completo, rol, contable_id || null],
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
          fields.push(`${key} = ?`);
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