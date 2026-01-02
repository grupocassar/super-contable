require('dotenv').config(); // ← AGREGADO AL INICIO

const fs = require('fs');
const path = require('path');
const { initDatabase, getDatabase, closeDatabase } = require('../config/database');
const { validateEnv } = require('../config/env');

async function runMigration(migrationFile) {
  const migrationPath = path.join(__dirname, 'migrations', migrationFile);
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const db = getDatabase();

  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

  for (const statement of statements) {
    await new Promise((resolve, reject) => {
      db.run(statement, (err) => {
        if (err) {
          if (err.message.includes('duplicate column name')) {
            console.log('   ⚠️  Column already exists, skipping...');
            resolve();
          } else {
            reject(err);
          }
          return;
        }
        resolve();
      });
    });
  }
}

async function migrate() {
  try {
    console.log('🔄 Running database migrations...\n');
    
    validateEnv();
    await initDatabase();

    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('ℹ️  No migrations to run');
      await closeDatabase();
      return;
    }

    console.log(`Found ${migrationFiles.length} migration(s):\n`);

    for (const file of migrationFiles) {
      console.log(`📝 Running: ${file}`);
      await runMigration(file);
      console.log(`✓ Completed: ${file}\n`);
    }

    await closeDatabase();
    console.log('✅ All migrations completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate, runMigration };