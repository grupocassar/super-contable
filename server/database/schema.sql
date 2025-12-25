-- Super Contable Database Schema
-- Sistema multi-tenant de gestión contable automatizada
-- República Dominicana

-- USUARIOS DEL SISTEMA
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre_completo TEXT NOT NULL,
  rol TEXT NOT NULL CHECK(rol IN ('super_admin', 'contable', 'asistente')),
  contable_id INTEGER,
  activo BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contable_id) REFERENCES users(id) ON DELETE SET NULL
);

-- EMPRESAS (Clientes del contable)
CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contable_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  rnc TEXT,
  codigo_corto TEXT,
  activa BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contable_id) REFERENCES users(id) ON DELETE CASCADE
);

-- USUARIOS FINALES (Telegram)
CREATE TABLE IF NOT EXISTS telegram_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  telegram_id TEXT UNIQUE NOT NULL,
  telegram_username TEXT,
  nombre TEXT,
  rol_empresa TEXT,
  activo BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- FACTURAS
CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id INTEGER NOT NULL,
  telegram_user_id INTEGER,

  -- DATOS EXTRAÍDOS
  fecha_factura DATE,
  ncf TEXT,
  rnc TEXT,
  proveedor TEXT,
  itbis DECIMAL(10,2),
  total_pagado DECIMAL(10,2),

  -- ARCHIVOS
  drive_url TEXT NOT NULL,

  -- PROCESAMIENTO
  estado TEXT NOT NULL DEFAULT 'pending' CHECK(estado IN ('pending', 'lista', 'aprobada', 'exportada', 'rechazada')),
  confidence_score DECIMAL(5,2),
  procesado_por INTEGER,
  fecha_procesado DATETIME,

  -- AUDITORÍA
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (telegram_user_id) REFERENCES telegram_users(id) ON DELETE SET NULL,
  FOREIGN KEY (procesado_por) REFERENCES users(id) ON DELETE SET NULL
);

-- ASIGNACIÓN DE EMPRESAS A ASISTENTES
CREATE TABLE IF NOT EXISTS asistente_empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asistente_id INTEGER NOT NULL,
  empresa_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asistente_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  UNIQUE(asistente_id, empresa_id)
);

-- AUDITORÍA
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factura_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  accion TEXT NOT NULL,
  cambios TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- EXPORTACIONES
CREATE TABLE IF NOT EXISTS exportaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contable_id INTEGER NOT NULL,
  empresa_id INTEGER,
  mes INTEGER NOT NULL,
  año INTEGER NOT NULL,
  cantidad_facturas INTEGER,
  archivo_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contable_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

-- ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_rol ON users(rol);
CREATE INDEX IF NOT EXISTS idx_users_contable_id ON users(contable_id);

CREATE INDEX IF NOT EXISTS idx_empresas_contable ON empresas(contable_id);
CREATE INDEX IF NOT EXISTS idx_empresas_activa ON empresas(activa);

CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_empresa ON telegram_users(empresa_id);

CREATE INDEX IF NOT EXISTS idx_facturas_empresa ON facturas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON facturas(fecha_factura);

CREATE INDEX IF NOT EXISTS idx_asistente_empresas_asistente ON asistente_empresas(asistente_id);
CREATE INDEX IF NOT EXISTS idx_asistente_empresas_empresa ON asistente_empresas(empresa_id);

CREATE INDEX IF NOT EXISTS idx_audit_factura ON audit_log(factura_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_exportaciones_contable ON exportaciones(contable_id);
CREATE INDEX IF NOT EXISTS idx_exportaciones_empresa ON exportaciones(empresa_id);
