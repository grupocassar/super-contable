-- Tabla para solicitudes de upgrade de plan
CREATE TABLE IF NOT EXISTS upgrade_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contable_id INTEGER NOT NULL,
    plan_actual VARCHAR(50) NOT NULL,
    plan_solicitado VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente',
    mensaje_contable TEXT,
    respuesta_admin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contable_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_upgrade_requests_contable ON upgrade_requests(contable_id);
CREATE INDEX idx_upgrade_requests_estado ON upgrade_requests(estado);
