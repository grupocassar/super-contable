-- Migración 003: Sistema de Colas para Procesamiento Asíncrono
-- Crea la tabla jobs_queue para desacoplar la recepción del procesamiento

CREATE TABLE IF NOT EXISTS jobs_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    file_id TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_ext TEXT NOT NULL,
    message_id INTEGER NOT NULL,
    estado TEXT DEFAULT 'pending',
    intentos INTEGER DEFAULT 0,
    max_intentos INTEGER DEFAULT 3,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (telegram_user_id) REFERENCES telegram_users(id),
    FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Índice para optimizar búsquedas por estado
CREATE INDEX IF NOT EXISTS idx_jobs_estado ON jobs_queue(estado);

-- Índice para optimizar búsquedas por fecha
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs_queue(created_at);