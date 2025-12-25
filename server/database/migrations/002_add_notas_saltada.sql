-- Migración 002: Agregar campos notas y saltada a facturas
-- Fecha: 2025-12-25
-- Descripción: Mejoras de UX para módulo asistente

-- Agregar campo para notas/comentarios del asistente al contable
ALTER TABLE facturas ADD COLUMN notas TEXT;

-- Agregar campo para marcar facturas saltadas temporalmente
ALTER TABLE facturas ADD COLUMN saltada BOOLEAN DEFAULT 0;
