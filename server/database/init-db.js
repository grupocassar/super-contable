require('dotenv').config(); // <--- CRITICO: Cargar variables antes de validar
const fs = require('fs');
const path = require('path');
const { initDatabase, getDatabase, closeDatabase } = require('../config/database');
const { validateEnv } = require('../config/env');

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing Super Contable database...\n');
    
    // Ahora validateEnv() encontrará el JWT_SECRET
    validateEnv(); 
    await initDatabase();
    
    const db = getDatabase();

    // PASO 1: DESACTIVAR FOREIGN KEYS TEMPORALMENTE
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = OFF', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // PASO 2: BORRAR TODAS LAS TABLAS EXISTENTES
    console.log('🗑️  Dropping existing tables...');
    const tables = await new Promise((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });

    for (const table of tables) {
      await new Promise((resolve, reject) => {
        db.run(`DROP TABLE IF EXISTS ${table.name}`, (err) => {
          if (err) {
            console.error(`   ✗ Error dropping table ${table.name}:`, err.message);
            resolve();
          } else {
            console.log(`   ✓ Dropped table: ${table.name}`);
            resolve();
          }
        });
      });
    }

    if (tables.length > 0) {
      console.log('');
    }

    // PASO 3: CREAR TABLAS DESDE SCHEMA
    console.log('📝 Creating tables from schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      await new Promise((resolve, reject) => {
        db.run(statement, (err) => {
          if (err) {
            console.error('Error executing statement:', statement.substring(0, 100) + '...');
            reject(err);
            return;
          }
          resolve();
        });
      });
    }

    console.log('✓ Database schema created successfully\n');

    // PASO 4: REACTIVAR FOREIGN KEYS
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // PASO 5: VERIFICAR TABLAS CREADAS
    const newTables = await new Promise((resolve, reject) => {
      db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });

    console.log('📊 Tables created:');
    newTables.forEach(table => {
      console.log(`   - ${table.name}`);
    });

    await closeDatabase();

    console.log('\n✅ Database initialization completed successfully!\n');
    console.log('Next steps:');
    console.log('   1. Run: npm run seed (to populate with test data)');
    console.log('   2. Run: npm start (to start the server)\n');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };