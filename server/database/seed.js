require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDatabase, getDatabase, closeDatabase } = require('../config/database');
const { validateEnv, config } = require('../config/env');

/**
 * Función auxiliar interna para ejecutar consultas (Fix: runQuery is not a function)
 */
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

/**
 * Script de población de base de datos (Seed) - VERSIÓN COMPLETA RECUPERADA
 * Sincronizado con el Esquema Maestro 606 (role, password, itbis_facturado, total_pagado)
 */
async function seedDatabase() {
  try {
    console.log('🌱 Seeding Super Contable database (Full Version)...\n');

    validateEnv();
    await initDatabase();

    // 1. Preparar Hashes de Contraseña
    const rounds = config.bcrypt?.rounds || 10;
    const adminHash = await bcrypt.hash('admin123', rounds);
    const contableHash = await bcrypt.hash('contable123', rounds);
    const asistenteHash = await bcrypt.hash('asistente123', rounds);

    console.log('--- 👤 Creando Usuarios ---');

    // Super Admin
    await runQuery(
      `INSERT INTO users (email, password, role) VALUES (?, ?, ?)`,
      ['admin@supercontable.com', adminHash, 'contable']
    );
    console.log('✓ Super Admin creado: admin@supercontable.com / admin123');

    // Contable Principal
    const contableResult = await runQuery(
      `INSERT INTO users (email, password, role) VALUES (?, ?, ?)`,
      ['juan@contable.com', contableHash, 'contable']
    );
    const contableId = contableResult.lastID;
    console.log('✓ Contable creado: juan@contable.com / contable123');

    // Asistente (Vinculado al contableId)
    const asistenteResult = await runQuery(
      `INSERT INTO users (email, password, role, contable_id) VALUES (?, ?, ?, ?)`,
      ['maria@asistente.com', asistenteHash, 'asistente', contableId]
    );
    const asistenteId = asistenteResult.lastID;
    console.log('✓ Asistente creado: maria@asistente.com / asistente123');

    console.log('\n--- 🏢 Creando Empresas ---');

    const empresa1Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto) VALUES (?, ?, ?, ?)`,
      [contableId, 'Supermercado Los Pinos', '130-12345-6', 'PINOS']
    );
    const empresa1Id = empresa1Result.lastID;
    console.log('✓ Empresa 1: Supermercado Los Pinos');

    const empresa2Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto) VALUES (?, ?, ?, ?)`,
      [contableId, 'Farmacia San José', '130-98765-4', 'FARMA']
    );
    const empresa2Id = empresa2Result.lastID;
    console.log('✓ Empresa 2: Farmacia San José');

    const empresa3Result = await runQuery(
      `INSERT INTO empresas (contable_id, nombre, rnc, codigo_corto) VALUES (?, ?, ?, ?)`,
      [contableId, 'Restaurant La Esquina', '130-55555-5', 'RESTA']
    );
    const empresa3Id = empresa3Result.lastID;
    console.log('✓ Empresa 3: Restaurant La Esquina');

    console.log('\n--- 🔗 Asignando Empresas al Asistente ---');
    const assignStmt = `INSERT INTO asistente_empresas (asistente_id, empresa_id) VALUES (?, ?)`;
    await runQuery(assignStmt, [asistenteId, empresa1Id]);
    await runQuery(assignStmt, [asistenteId, empresa2Id]);
    await runQuery(assignStmt, [asistenteId, empresa3Id]);
    console.log('✓ Empresas asignadas a María correctamente.');

    console.log('\n--- 🤖 Creando Usuarios de Telegram ---');
    const tgStmt = `INSERT INTO telegram_users (empresa_id, telegram_id, username, first_name) VALUES (?, ?, ?, ?)`;
    await runQuery(tgStmt, [empresa1Id, '123456789', 'don_jose', 'José Martínez']);
    await runQuery(tgStmt, [empresa2Id, '987654321', 'ana_farmacia', 'Ana López']);
    console.log('✓ Usuarios de Telegram creados.');

    console.log('\n--- 📄 Cargando Lote de Facturas de Prueba (17 registros) ---');

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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
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
        estado: 'pendiente',
        confidence_score: 69.5
      },

      // FACTURAS YA LISTAS (2 registros)
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

    for (const f of facturas) {
      await runQuery(
        `INSERT INTO facturas (
          empresa_id, fecha_factura, ncf, rnc, proveedor,
          itbis_facturado, total_pagado, drive_url, estado, confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.empresa_id,
          f.fecha_factura,
          f.ncf,
          f.rnc,
          f.proveedor,
          f.itbis,
          f.total_pagado,
          f.drive_url,
          f.estado,
          f.confidence_score
        ]
      );
    }

    console.log(`\n✓ ${facturas.length} facturas de muestra creadas (Sincronizadas con 606).`);
    console.log(' 🟢 Alta confianza (>95%): 6');
    console.log(' 🟡 Media confianza (80-95%): 5');
    console.log(' 🔴 Baja confianza (<80%): 4');
    console.log(' 📋 Listas para aprobación: 2');

    await closeDatabase();
    console.log('\n✅ Base de Datos poblada con éxito. Sistema listo.');

  } catch (error) {
    console.error('\n❌ Error fatal en el Seed:', error.message);
    process.exit(1);
  }
}

// Ejecución directa si se llama al script
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };