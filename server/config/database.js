const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { config } = require('./env');

let db = null;

const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(config.database.path);
    const dbDir = path.dirname(dbPath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`✓ Connected to SQLite database at: ${dbPath}`);
        db.run('PRAGMA foreign_keys = ON');
        resolve(db);
      }
    });
  });
};

const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          db = null;
          console.log('✓ Database connection closed');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};