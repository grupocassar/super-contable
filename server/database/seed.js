const bcrypt = require('bcryptjs');
const { initDatabase, runQuery, closeDatabase } = require('../config/database');
const { validateEnv, config } = require('../config/env');

async function seedDatabase() {
  try {
    console.log('🌱 Seeding Super Contable database...\n');

    validateEnv();
    await initDatabase();

    const passwordHash = await bcrypt.hash('admin123', config.bcrypt.rounds);

    console.log('Creating users...');

    const superAdminResult = await runQuery(
      `INSERT INTO users (email, password_hash, nombre_completo, rol, activo)
       VALUES (?, ?, ?, ?, ?)`,
      ['admin@supercontable.com', passwordHash, 'Super Administrador', 'super_admin', 1]
    );
    console.log('✓ Super Admin created (email: admin@supercontable.com, password: admin123)');

    const contableHash = await bcrypt.hash('contable123', config.bcrypt.rounds);
    const contableResult = await runQuery(
      `INSERT INTO users (email, password_hash, nombre_completo, rol, activo)
       VALUES (?, ?, ?, ?, ?)`,
      ['juan@contable.com', contableHash, 'Juan Pérez Contable', 'contable', 1]
    );
    const contableId = contableResult.lastID;
    console.log('✓ Contable created (email: juan@contable.com, password: contable123)');

    const asistenteHash = await bcrypt.hash('asistente123', config.bcrypt.rounds);
    const asistenteResult = await runQuery(
      `INSERT INTO users (email, password_hash, nombre_completo, rol, contable_id, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['maria@asistente.com', asistenteHash, 'María García Asistente', 'asistente', contableId, 1]
    );
    const asistenteId = asistenteResult.lastID;
    console.log('✓ Asistente created (email: maria@asistente.com, password: asistente123)');

    console.log('\nCreating empresas...');

    const empresa1Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto, activa)
       VALUES (?, ?, ?, ?, ?)`,
      [contableId, 'Empresa Demo S.R.L.', '123-45678-9', 'DEMO', 1]
    );
    const empresa1Id = empresa1Result.lastID;
    console.log('✓ Empresa 1: Empresa Demo S.R.L.');

    const empresa2Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto, activa)
       VALUES (?, ?, ?, ?, ?)`,
      [contableId, 'Comercial La Esperanza', '987-65432-1', 'COMESP', 1]
    );
    const empresa2Id = empresa2Result.lastID;
    console.log('✓ Empresa 2: Comercial La Esperanza');

    console.log('\nAssigning empresas to asistente...');
    await runQuery(
      `INSERT INTO asistente_empresas (asistente_id, empresa_id)
       VALUES (?, ?)`,
      [asistenteId, empresa1Id]
    );
    await runQuery(
      `INSERT INTO asistente_empresas (asistente_id, empresa_id)
       VALUES (?, ?)`,
      [asistenteId, empresa2Id]
    );
    console.log('✓ Empresas assigned to asistente');

    console.log('\nCreating telegram users...');
    await runQuery(
      `INSERT INTO telegram_users (empresa_id, telegram_id, telegram_username, nombre, rol_empresa, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresa1Id, '123456789', 'user_demo', 'Carlos Martínez', 'Gerente', 1]
    );
    console.log('✓ Telegram user for Empresa Demo');

    console.log('\nCreating sample facturas...');

    const facturas = [
      {
        empresa_id: empresa1Id,
        fecha_factura: '2024-01-15',
        ncf: 'B0100000001',
        rnc: '131-123456-7',
        proveedor: 'Suplidora del Norte',
        itbis: 1800.00,
        total_pagado: 11800.00,
        drive_url: 'https://drive.google.com/file/d/sample1',
        estado: 'pending'
      },
      {
        empresa_id: empresa1Id,
        fecha_factura: '2024-01-16',
        ncf: 'B0100000002',
        rnc: '131-654321-8',
        proveedor: 'Distribuidora Central',
        itbis: 900.00,
        total_pagado: 5900.00,
        drive_url: 'https://drive.google.com/file/d/sample2',
        estado: 'pending'
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2024-01-17',
        ncf: 'B0100000003',
        rnc: '131-987654-2',
        proveedor: 'Importadora Premium',
        itbis: 2700.00,
        total_pagado: 17700.00,
        drive_url: 'https://drive.google.com/file/d/sample3',
        estado: 'pending'
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2024-01-18',
        ncf: 'B0100000004',
        rnc: '131-456789-3',
        proveedor: 'Servicios Integrados',
        itbis: 450.00,
        total_pagado: 2950.00,
        drive_url: 'https://drive.google.com/file/d/sample4',
        estado: 'lista',
        confidence_score: 95.5
      },
      {
        empresa_id: empresa1Id,
        fecha_factura: '2024-01-19',
        ncf: 'B0100000005',
        rnc: '131-789012-4',
        proveedor: 'Tecnología Avanzada',
        itbis: 3600.00,
        total_pagado: 23600.00,
        drive_url: 'https://drive.google.com/file/d/sample5',
        estado: 'pending'
      }
    ];

    for (const factura of facturas) {
      await runQuery(
        `INSERT INTO facturas (
          empresa_id, fecha_factura, ncf, rnc, proveedor,
          itbis, total_pagado, drive_url, estado, confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          factura.empresa_id,
          factura.fecha_factura,
          factura.ncf,
          factura.rnc,
          factura.proveedor,
          factura.itbis,
          factura.total_pagado,
          factura.drive_url,
          factura.estado,
          factura.confidence_score || null
        ]
      );
    }
    console.log(`✓ ${facturas.length} sample facturas created`);

    await closeDatabase();

    console.log('\n✅ Database seeded successfully!\n');
    console.log('📝 Test Accounts:');
    console.log('   Super Admin: admin@supercontable.com / admin123');
    console.log('   Contable:    juan@contable.com / contable123');
    console.log('   Asistente:   maria@asistente.com / asistente123\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
