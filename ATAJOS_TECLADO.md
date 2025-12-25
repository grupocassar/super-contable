# ⌨️ Atajos de Teclado - Módulo Asistente

## Atajos en el Modal de Validación

Cuando el modal de validación de facturas está abierto, puedes usar los siguientes atajos:

| Atajo | Acción |
|-------|--------|
| `Enter` | Guardar cambios + Marcar como lista + Ir a siguiente factura |
| `Ctrl + Enter` | Marcar como lista + Cerrar modal |
| `R` | Rechazar factura actual |
| `S` | Saltar factura (revisar después) |
| `←` / `→` | Navegar entre facturas (anterior/siguiente) |
| `Esc` | Cerrar modal sin guardar |
| `?` | Mostrar/ocultar panel de ayuda |

## Atajos Globales

| Atajo | Acción |
|-------|--------|
| `?` | Mostrar panel de ayuda de atajos |

## Flujo de Trabajo Recomendado

### Validación Rápida (Solo Teclado)

1. Haz click en "Editar" para abrir la primera factura
2. Revisa y edita los campos necesarios usando `Tab` para navegar
3. Presiona `Enter` para guardar y pasar a la siguiente
4. Repite hasta terminar
5. Si necesitas saltar una factura problemática, presiona `S`
6. Si quieres rechazar una factura, presiona `R`

### Deshacer Acción

- Después de marcar una factura como "lista", tienes 8 segundos para deshacer
- Aparecerá un banner en la esquina superior derecha
- Haz click en "Deshacer" o espera 8 segundos para confirmar

## Características Adicionales

### Contador de Progreso

Muestra en tiempo real:
- Facturas procesadas vs pendientes
- Tiempo trabajado en la sesión
- Ritmo promedio (min/factura)
- Tiempo estimado para terminar

El progreso se resetea automáticamente cada día.

### Campo de Notas

- Permite agregar comentarios para el contable
- Opcional, se muestra con el icono 💬 en la lista
- Útil para comunicar dudas o advertencias

### Detección de Duplicados

- Automática al abrir una factura
- Busca NCF duplicados en las empresas asignadas
- Muestra alerta con detalles de la factura existente

### Facturas Saltadas

- Marca facturas para revisar después
- Se muestran con el icono ⏭️ en la lista
- Puedes filtrarlas o volver a ellas al final del día

## Tips de Productividad

1. **Usa Enter para avanzar rápido**: Si la factura está bien, solo presiona Enter
2. **Salta facturas problemáticas**: No pierdas tiempo, usa `S` y revísalas después
3. **Aprovecha el contador**: Te ayuda a medir tu progreso y planificar pausas
4. **Usa notas para dudas**: Mejor comunicar que adivinar
5. **Revisa el panel de ayuda**: Presiona `?` si olvidas un atajo
