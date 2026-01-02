-- Migración 005: Planes contratados (CORREGIDA)

-- 1. Eliminar tabla anterior si existe para recrearla correctamente
DROP TABLE IF EXISTS contables_planes;

-- 2. Crear tabla apuntando a 'users'
CREATE TABLE contables_planes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contable_id INTEGER NOT NULL,
    plan VARCHAR(20) NOT NULL DEFAULT 'STARTER',
    limite_facturas INTEGER NOT NULL DEFAULT 1000,
    zona_gracia INTEGER NOT NULL DEFAULT 50,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_renovacion DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contable_id) REFERENCES users(id)
);

-- 3. Índice para búsquedas rápidas
CREATE INDEX idx_contables_planes_contable 
ON contables_planes(contable_id);

-- 4. Insertar plan por defecto tomando los IDs de la tabla 'users'
INSERT INTO contables_planes (contable_id, plan, limite_facturas, zona_gracia)
SELECT id, 'PROFESSIONAL', 1500, 100
FROM users
WHERE id NOT IN (SELECT contable_id FROM contables_planes);