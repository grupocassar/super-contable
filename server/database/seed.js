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
      [contableId, 'Supermercado Los Pinos', '130-12345-6', 'PINOS', 1]
    );
    const empresa1Id = empresa1Result.lastID;
    console.log('✓ Empresa 1: Supermercado Los Pinos');

    const empresa2Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto, activa)
       VALUES (?, ?, ?, ?, ?)`,
      [contableId, 'Farmacia San José', '130-98765-4', 'FARMA', 1]
    );
    const empresa2Id = empresa2Result.lastID;
    console.log('✓ Empresa 2: Farmacia San José');

    const empresa3Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto, activa)
       VALUES (?, ?, ?, ?, ?)`,
      [contableId, 'Restaurant La Esquina', '130-55555-5', 'RESTA', 1]
    );
    const empresa3Id = empresa3Result.lastID;
    console.log('✓ Empresa 3: Restaurant La Esquina');

    console.log('\nAssigning empresas to asistente...');
    await runQuery(
      `INSERT INTO asistente_empresas (asistente_id, empresa_id) VALUES (?, ?)`,
      [asistenteId, empresa1Id]
    );
    await runQuery(
      `INSERT INTO asistente_empresas (asistente_id, empresa_id) VALUES (?, ?)`,
      [asistenteId, empresa2Id]
    );
    await runQuery(
      `INSERT INTO asistente_empresas (asistente_id, empresa_id) VALUES (?, ?)`,
      [asistenteId, empresa3Id]
    );
    console.log('✓ Empresas assigned to asistente');

    console.log('\nCreating telegram users...');
    await runQuery(
      `INSERT INTO telegram_users (empresa_id, telegram_id, telegram_username, nombre, rol_empresa, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresa1Id, '123456789', 'don_jose', 'José Martínez', 'Dueño', 1]
    );
    await runQuery(
      `INSERT INTO telegram_users (empresa_id, telegram_id, telegram_username, nombre, rol_empresa, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [empresa2Id, '987654321', 'ana_farmacia', 'Ana López', 'Gerente', 1]
    );
    console.log('✓ Telegram users created');

    console.log('\nCreating sample facturas...');

    const facturas = [
      // ALTA CONFIANZA (>95%) - 6 facturas
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-15',
        ncf: 'B0100012345',
        rnc: '130-11111-1',
        proveedor: 'Ferretería El Martillo',
        itbis: 2850.00,
        total_pagado: 18500.00,
        drive_url: 'https://drive.google.com/file/d/factura001',
        estado: 'pending',
        confidence_score: 98.5
      },
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-16',
        ncf: 'B0100012346',
        rnc: '130-22222-2',
        proveedor: 'Distribuidora Corona',
        itbis: 4200.00,
        total_pagado: 26000.00,
        drive_url: 'https://drive.google.com/file/d/factura002',
        estado: 'pending',
        confidence_score: 97.2
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2025-12-17',
        ncf: 'B0100012347',
        rnc: '130-33333-3',
        proveedor: 'Laboratorios Farma Plus',
        itbis: 1800.00,
        total_pagado: 11800.00,
        drive_url: 'https://drive.google.com/file/d/factura003',
        estado: 'pending',
        confidence_score: 96.8
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2025-12-18',
        ncf: 'B0100012348',
        rnc: '130-44444-4',
        proveedor: 'Suplidora Médica Central',
        itbis: 900.00,
        total_pagado: 5900.00,
        drive_url: 'https://drive.google.com/file/d/factura004',
        estado: 'pending',
        confidence_score: 99.1
      },
      {
        empresa_id: empresa3Id,
        fecha_factura: '2025-12-19',
        ncf: 'B0100012349',
        rnc: '130-55555-5',
        proveedor: 'Distribuidora de Alimentos',
        itbis: 3600.00,
        total_pagado: 23600.00,
        drive_url: 'https://drive.google.com/file/d/factura005',
        estado: 'pending',
        confidence_score: 95.7
      },
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-20',
        ncf: 'B0100012350',
        rnc: '130-66666-6',
        proveedor: 'Papelería Moderna',
        itbis: 450.00,
        total_pagado: 2950.00,
        drive_url: 'https://drive.google.com/file/d/factura006',
        estado: 'pending',
        confidence_score: 97.5
      },

      // MEDIA CONFIANZA (80-95%) - 5 facturas
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-15',
        ncf: 'B0100012351',
        rnc: '130-77777-7',
        proveedor: 'Servicios Generales ABC',
        itbis: 1350.00,
        total_pagado: 8850.00,
        drive_url: 'https://drive.google.com/file/d/factura007',
        estado: 'pending',
        confidence_score: 88.3
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2025-12-16',
        ncf: 'B0100012352',
        rnc: '130-88888-8',
        proveedor: 'Tecnología Médica',
        itbis: 2700.00,
        total_pagado: 17700.00,
        drive_url: 'https://drive.google.com/file/d/factura008',
        estado: 'pending',
        confidence_score: 84.7
      },
      {
        empresa_id: empresa3Id,
        fecha_factura: '2025-12-17',
        ncf: 'B0100012353',
        rnc: '130-99999-9',
        proveedor: 'Carnicería La Central',
        itbis: 1200.00,
        total_pagado: 7900.00,
        drive_url: 'https://drive.google.com/file/d/factura009',
        estado: 'pending',
        confidence_score: 91.2
      },
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-18',
        ncf: 'B0100012354',
        rnc: '130-10101-1',
        proveedor: 'Equipos Industriales',
        itbis: 5400.00,
        total_pagado: 35400.00,
        drive_url: 'https://drive.google.com/file/d/factura010',
        estado: 'pending',
        confidence_score: 82.9
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2025-12-19',
        ncf: 'B0100012355',
        rnc: '130-20202-2',
        proveedor: 'Importadora del Caribe',
        itbis: 750.00,
        total_pagado: 4950.00,
        drive_url: 'https://drive.google.com/file/d/factura011',
        estado: 'pending',
        confidence_score: 87.6
      },

      // BAJA CONFIANZA (<80%) - 4 facturas
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-15',
        ncf: 'B0100012356',
        rnc: '130-30303-3',
        proveedor: 'Proveedor XYZ',
        itbis: 600.00,
        total_pagado: 3900.00,
        drive_url: 'https://drive.google.com/file/d/factura012',
        estado: 'pending',
        confidence_score: 72.4
      },
      {
        empresa_id: empresa3Id,
        fecha_factura: '2025-12-16',
        ncf: 'B0100012357',
        rnc: '130-40404-4',
        proveedor: 'Servicios Múltiples',
        itbis: 1080.00,
        total_pagado: 7080.00,
        drive_url: 'https://drive.google.com/file/d/factura013',
        estado: 'pending',
        confidence_score: 65.8
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2025-12-17',
        ncf: 'B0100012358',
        rnc: '130-50505-5',
        proveedor: 'Comercial La Estrella',
        itbis: 1500.00,
        total_pagado: 9850.00,
        drive_url: 'https://drive.google.com/file/d/factura014',
        estado: 'pending',
        confidence_score: 78.2
      },
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-18',
        ncf: 'B0100012359',
        rnc: '130-60606-6',
        proveedor: 'Mantenimiento Express',
        itbis: 300.00,
        total_pagado: 1970.00,
        drive_url: 'https://drive.google.com/file/d/factura015',
        estado: 'pending',
        confidence_score: 69.5
      },

      // FACTURAS YA LISTAS (2 para probar aprobación en lote)
      {
        empresa_id: empresa1Id,
        fecha_factura: '2025-12-14',
        ncf: 'B0100012360',
        rnc: '130-70707-7',
        proveedor: 'Seguridad Total',
        itbis: 1200.00,
        total_pagado: 7850.00,
        drive_url: 'https://drive.google.com/file/d/factura016',
        estado: 'lista',
        confidence_score: 94.5
      },
      {
        empresa_id: empresa2Id,
        fecha_factura: '2025-12-14',
        ncf: 'B0100012361',
        rnc: '130-80808-8',
        proveedor: 'Limpieza Profesional',
        itbis: 540.00,
        total_pagado: 3540.00,
        drive_url: 'https://drive.google.com/file/d/factura017',
        estado: 'lista',
        confidence_score: 96.2
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
    console.log('  🟢 Alta confianza (>95%):   6 facturas');
    console.log('  🟡 Media confianza (80-95%): 5 facturas');
    console.log('  🔴 Baja confianza (<80%):    4 facturas');
    console.log('  📋 Ya listas para aprobar:  2 facturas');

    await closeDatabase();

    console.log('\n✅ Database seeded successfully!\n');
    console.log('📝 Test Accounts:');
    console.log('   Super Admin: admin@supercontable.com / admin123');
    console.log('   Contable:    juan@contable.com / contable123');
    console.log('   Asistente:   maria@asistente.com / asistente123\n');
    console.log('🏢 Empresas:');
    console.log('   1. Supermercado Los Pinos');
    console.log('   2. Farmacia San José');
    console.log('   3. Restaurant La Esquina\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };