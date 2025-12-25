const fs = require('fs');
const path = require('path');
const { initDatabase, getDatabase, closeDatabase } = require('../config/database');
const { validateEnv } = require('../config/env');

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing Super Contable database...\n');

    validateEnv();

    await initDatabase();

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const db = getDatabase();

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

    console.log('📊 Tables created:');
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });

    await closeDatabase();

    console.log('\n✅ Database initialization completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run seed (to populate with test data)');
    console.log('  2. Run: npm start (to start the server)\n');

  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
