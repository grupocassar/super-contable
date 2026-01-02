-- Migración 004: Agregar chat_id para notificaciones de rechazo
-- Permite al bot reenviar imágenes rechazadas al usuario

ALTER TABLE telegram_users ADD COLUMN chat_id TEXT;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_telegram_users_chat_id ON telegram_users(chat_id);