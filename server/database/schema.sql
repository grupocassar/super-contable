-- ==========================================================
-- ESQUEMA MAESTRO: SUPER CONTABLE (REPORTE 606 + DRIVE)
-- ==========================================================

-- 1. Usuarios (Contables y Asistentes)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'contable',
    contable_id INTEGER,
    -- Columnas para Google Drive
    drive_refresh_token TEXT,
    drive_access_token TEXT,
    drive_connected INTEGER DEFAULT 0, -- <--- COLUMNA QUE FALTABA
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contable_id) REFERENCES users(id)
);

-- 2. Empresas
CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    rnc TEXT,
    codigo_corto TEXT UNIQUE,
    contable_id INTEGER,
    activa BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contable_id) REFERENCES users(id)
);

-- 3. Usuarios de Telegram
CREATE TABLE IF NOT EXISTS telegram_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    empresa_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- 4. Facturas (Estructura de 23 campos para Reporte 606 DGII)
CREATE TABLE IF NOT EXISTS facturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    telegram_user_id INTEGER,
    telegram_message_id TEXT,
    
    -- Datos Fiscales
    fecha_factura TEXT,
    rnc TEXT,
    ncf TEXT,
    proveedor TEXT,
    
    -- Montos e ITBIS
    monto_servicios REAL DEFAULT 0,
    monto_bienes REAL DEFAULT 0,
    itbis_facturado REAL DEFAULT 0,
    itbis_retenido REAL DEFAULT 0,
    itbis_proporcionalidad REAL DEFAULT 0,
    itbis_costo REAL DEFAULT 0,
    itbis_adelantar REAL DEFAULT 0,
    itbis_percibido REAL DEFAULT 0,
    
    -- Retenciones e Impuestos
    tipo_retencion_isr TEXT,
    monto_retencion_isr REAL DEFAULT 0,
    isr_percibido REAL DEFAULT 0,
    impuesto_selectivo REAL DEFAULT 0,
    otros_impuestos REAL DEFAULT 0,
    propina_legal REAL DEFAULT 0,
    
    -- Clasificación
    tipo_id TEXT,
    tipo_gasto TEXT,
    forma_pago TEXT,
    fecha_pago TEXT,
    ncf_modificado TEXT,
    
    -- Control
    total_pagado REAL DEFAULT 0,
    estado TEXT DEFAULT 'pendiente',
    confidence_score REAL,
    drive_url TEXT,
    notas TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id),
    FOREIGN KEY (telegram_user_id) REFERENCES telegram_users(id)
);

-- 5. Relación Asistente-Empresa
CREATE TABLE IF NOT EXISTS asistente_empresas (
    asistente_id INTEGER,
    empresa_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (asistente_id, empresa_id),
    FOREIGN KEY (asistente_id) REFERENCES users(id),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- 6. Historial de Exportaciones
CREATE TABLE IF NOT EXISTS exportaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contable_id INTEGER,
    periodo_mes TEXT,
    periodo_anio TEXT,
    spreadsheet_id TEXT,
    spreadsheet_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contable_id) REFERENCES users(id)
);