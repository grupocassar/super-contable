# 📊 Super Contable - Pre-Optimizador Fiscal Inteligente

Plataforma SaaS multi-tenant diseñada para automatizar, limpiar y validar el flujo de facturas antes de que lleguen al software contable final.

**Concepto:** No somos un ERP ni un software de declaración de impuestos. Somos el puente inteligente que transforma el caos de facturas físicas/digitales en datos limpios, auditados y listos para importar.

---

## 🚀 Estado Actual (Fase 2 Completada)

El sistema ha evolucionado de un simple gestor de archivos a un **Auditor Fiscal Automatizado** con las siguientes capacidades:

---

## 1. 🎯 Módulo Pre-Cierre Fiscal (La Joya de la Corona)

Mesa de trabajo tipo Excel para que el contable audite y limpie el mes en minutos.

### Características:
- **Edición Inline:** Modificación rápida de fechas, NCF, RNC y montos sin recargar.
- **🧠 Memoria Contable (IA):** El sistema "aprende" del historial. Si clasificas a un proveedor una vez, la próxima vez te sugerirá automáticamente el Tipo de Gasto y Forma de Pago.
- **Semáforo de Anomalías:** Detección automática de errores antes de exportar:
  - 🔴 **Duplicados:** NCFs repetidos (con modal de comparación lado a lado).
    - 🟡 **Sospechosas:** Mismo proveedor + fecha + monto, pero NCF distinto.
      - 🟠 **Fuera de Período:** Facturas con fechas que no corresponden al mes de cierre seleccionado.
        - 🔶 **RNC Inválido:** Validación de formato y longitud de documentos de identidad.
          - 🧾 **ITBIS en Cero:** Alerta en facturas con valor fiscal (B01) sin impuestos reportados.
            - ⚠️ **Sin Clasificar:** Facturas pendientes de asignación de gasto.
            - **Exportación Limpia:** Generación de CSV formateado para integración, con opción de limpieza automática ("Inbox Zero").
            - **Histórico Inmutable:** Las facturas procesadas se archivan y bloquean para proteger la integridad del cierre.

            ---

            ## 2. 🤖 Bot de Telegram (Recepción Automática)

            Flujo 100% automatizado desde el usuario final hasta el sistema.

            ### Características:
            - **Recepción de Imágenes:** Los usuarios finales envían fotos de facturas directamente al bot.
            - **Enrutamiento Inteligente:** El bot identifica automáticamente a qué empresa pertenece cada factura según el remitente (Telegram ID).
            - **Integración Drive:** Las imágenes se suben automáticamente al Google Drive del contable correspondiente (OAuth 2.0).
            - **Persistencia:** URL de Drive se guarda en la base de datos para auditoría permanente.
            - **Estado Automático:** Facturas entran con estado `pending` listas para validación del asistente.

            **Tabla asociada:** `telegram_users` (mapeo Telegram ID → Empresa)

            ---

            ## 3. ☁️ OAuth 2.0 Google Drive (Almacenamiento por Contable)

            Cada contable conecta su propio Google Drive para almacenar las facturas de forma segura y auditable.

            ### Características:
            - **Seguridad:** Sin Service Accounts genéricas. Cada contable autoriza la aplicación desde su panel.
            - **Responsabilidad Legal:** Las facturas quedan en el Drive del contable, no en un servidor centralizado.
            - **Organización Automática:** Carpeta `SuperContable/[Empresa]/[Año]/[Mes]/` creada automáticamente.
            - **Auditoría CSV:** Al exportar, el CSV incluye un enlace directo a la imagen en Drive.
            - **Escalabilidad:** Múltiples contables pueden trabajar simultáneamente sin conflictos.

            **Flujo OAuth:**
            1. Contable hace clic en "Conectar Drive" → Autoriza app en Google
            2. Sistema guarda `refresh_token` en BD
            3. Bot usa token del contable para subir archivos A NOMBRE del contable
            4. Facturas usan cuota del contable (no del sistema)

            ---

            ## 4. 🖥️ Módulo Asistente (Digitación Asistida)

            Interfaz optimizada para la digitación de alta velocidad.

            ### Características:
            - **Vista Dividida (Split View):** Imagen de factura a la izquierda, formulario a la derecha.
            - **Zoom Inteligente:** Controles de visualización para detalles finos.
            - **Auto-Save:** Guardado automático al perder el foco (sin botones redundantes).
            - **Comunicación:** Sistema de notas integrado para alertar al contable sobre anomalías físicas (borroso, roto, etc.).
            - **Flujo de Aprobación:** 
              - Aprobar → Pasa a Pre-Cierre
                - Rechazar → Archiva
                  - Saltar → Marca para revisión posterior

                  ---

                  ## 5. 🛡️ Panel Administrativo & Seguridad

                  - **Multi-Tenant:** Datos aislados por Contable y por Empresa.
                  - **Roles Jerárquicos:** Super Admin > Contable > Asistente.
                  - **Seguridad:** Encriptación de contraseñas (Bcrypt) y manejo de sesiones seguras (JWT).
                  - **Auditoría:** Tabla `audit_log` registra todas las modificaciones.

                  ---

                  ## 🏗️ Stack Tecnológico

                  ### Backend
                  - **Runtime:** Node.js >= 18.0.0
                  - **Framework:** Express.js
                  - **Autenticación:** JWT (jsonwebtoken)
                  - **Bot:** node-telegram-bot-api
                  - **Google APIs:** googleapis (OAuth 2.0 + Drive v3)
                  - **HTTP Client:** axios

                  ### Base de Datos
                  - **Motor:** SQLite3
                  - **Optimizaciones:** Índices para consultas rápidas
                  - **Migraciones:** Sistema de versionado controlado

                  ### Frontend
                  - **JavaScript:** Vanilla (Sin frameworks pesados)
                  - **Estilos:** CSS3 Moderno (Variables, Flexbox, Grid)
                  - **Arquitectura:** MVC (Modelo-Vista-Controlador)

                  ### Seguridad
                  - **Helmet:** Protección de headers HTTP
                  - **CORS:** Configuración de orígenes permitidos
                  - **Rate Limiting:** express-rate-limit
                  - **Validación:** express-validator

                  ---

                  ## 📦 Instalación y Despliegue

                  ### Prerrequisitos
                  - Node.js >= 18.0.0
                  - npm >= 9.0.0
                  - Cuenta de Google (para OAuth Drive)
                  - Bot de Telegram (obtener token en @BotFather)

                  ### Pasos de Instalación

                  #### 1. Clonar el repositorio
                  ```bash
                  git clone <repository-url>
                  cd super-contable
                  ```

                  #### 2. Instalar dependencias
                  ```bash
                  npm install
                  ```

                  #### 3. Configuración

                  Crea un archivo `.env` en la raíz:

                  ```env
                  NODE_ENV=development
                  PORT=3000
                  DB_PATH=./database/super-contable.db
                  JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion

                  # Telegram Bot
                  TELEGRAM_BOT_TOKEN=tu_token_de_botfather

                  # Google OAuth (obtener en Google Cloud Console)
                  GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
                  GOOGLE_CLIENT_SECRET=tu_client_secret
                  GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
                  ```

                  #### 4. Base de Datos

                  Inicializa las tablas y carga datos semilla para pruebas:

                  ```bash
                  npm run init-db
                  npm run seed
                  ```

                  #### 5. Iniciar Servidor

                  ```bash
                  npm start
                  # o para desarrollo con auto-reload:
                  npm run dev
                  ```

                  Accede a: **http://localhost:3000**

                  ---

                  ## 👥 Cuentas de Prueba (Seed Data)

                  | Rol | Email | Password | Alcance |
                  |-----|-------|----------|---------|
                  | Super Admin | admin@supercontable.com | admin123 | Control total del sistema |
                  | Contable | juan@contable.com | contable123 | Gestión de Empresas y Pre-Cierre |
                  | Asistente | maria@asistente.com | asistente123 | Digitación y Validación inicial |

                  ---

                  ## 🗄️ Esquema de Datos

                  ### Tablas Principales

                  #### `facturas` (Corazón del sistema)

                  | Campo | Tipo | Descripción |
                  |-------|------|-------------|
                  | id | INTEGER | Primary Key |
                  | empresa_id | INTEGER | Foreign Key → empresas |
                  | telegram_user_id | INTEGER | Foreign Key → telegram_users |
                  | fecha_factura | DATE | Fecha del comprobante |
                  | ncf | TEXT | Número de Comprobante Fiscal |
                  | rnc | TEXT | Identificación del proveedor |
                  | proveedor | TEXT | Nombre del proveedor |
                  | itbis | DECIMAL(10,2) | Impuesto ITBIS |
                  | total_pagado | DECIMAL(10,2) | Monto total |
                  | drive_url | TEXT | **Enlace a Google Drive** |
                  | estado | TEXT | `pending`, `lista`, `aprobada`, `exportada`, `rechazada` |
                  | confidence_score | DECIMAL(5,2) | Score de confianza OCR (futuro) |
                  | tipo_gasto | TEXT | **Categoría DGII (E01-E11)** |
                  | forma_pago | TEXT | **Método de pago (01-06)** |
                  | revisada | BOOLEAN | **Flag para anomalías verificadas** |
                  | notas | TEXT | **Comentarios del asistente** |
                  | saltada | BOOLEAN | **Marcada para revisión posterior** |
                  | updated_by | INTEGER | Último usuario que modificó |
                  | approved_at | DATETIME | Fecha de aprobación |
                  | approved_by | INTEGER | Usuario que aprobó |

                  #### `telegram_users` (Mapeo Telegram → Empresa)

                  | Campo | Tipo | Descripción |
                  |-------|------|-------------|
                  | id | INTEGER | Primary Key |
                  | empresa_id | INTEGER | Foreign Key → empresas |
                  | telegram_id | INTEGER | **ID único de Telegram** |
                  | telegram_username | TEXT | @username de Telegram |
                  | first_name | TEXT | Nombre del usuario |
                  | last_name | TEXT | Apellido del usuario |
                  | created_at | DATETIME | Fecha de registro |

                  #### `exportaciones` (Histórico de Exports)

                  | Campo | Tipo | Descripción |
                  |-------|------|-------------|
                  | id | INTEGER | Primary Key |
                  | contable_id | INTEGER | Foreign Key → contables |
                  | periodo_mes | TEXT | Mes exportado (01-12) |
                  | periodo_anio | TEXT | Año exportado |
                  | total_facturas | INTEGER | Cantidad exportada |
                  | created_at | DATETIME | Fecha del export |

                  ---

                  ## 🚀 Roadmap del Proyecto

                  ### ✅ Fase 1: Cimientos (Completada)
                  - [x] Autenticación y Seguridad JWT
                  - [x] CRUD de Usuarios y Empresas
                  - [x] Estructura de Base de Datos Base

                  ### ✅ Fase 2: Lógica de Negocio & Automatización (Completada)
                  - [x] Módulo de Asistente (Split View + Auto-Save)
                  - [x] Módulo Contable (Dashboard + Pre-Cierre Fiscal)
                  - [x] **Bot de Telegram (Recepción automática)**
                  - [x] **OAuth 2.0 Google Drive (Almacenamiento por contable)**
                  - [x] Motor de Anomalías: Duplicados, Fechas, RNC, ITBIS
                  - [x] Memoria Contable: Sugerencias automáticas basadas en historial
                  - [x] Ciclo de Cierre: Exportación CSV + Archivado (Limpieza)
                  - [x] **Flujo End-to-End: Telegram → Drive → Dashboard → Export**

                  ### 📅 Fase 3: Inteligencia Artificial (Próximo)
                  - [ ] **OCR Automático (Mindee/Google Vision)** ← PRÓXIMO PASO
                  - [ ] Extracción automática: NCF, RNC, Fecha, Proveedor, Montos
                  - [ ] Clasificación automática de Tipo de Gasto (Machine Learning)
                  - [ ] Detección de fraude mediante patrones

                  ### 📅 Fase 4: Escalabilidad & Integraciones (Futuro)
                  - [ ] Migración a PostgreSQL para producción masiva
                  - [ ] API Pública para integración con ERPs
                  - [ ] Webhooks para notificaciones en tiempo real
                  - [ ] Panel de Analytics y Reportes avanzados

                  ---

                  ## 🔧 Scripts Disponibles

                  ```bash
                  npm start       # Iniciar servidor en producción
                  npm run dev     # Iniciar con auto-reload (nodemon)
                  npm run init-db # Reiniciar base de datos (⚠️ borra datos)
                  npm run migrate # Aplicar migraciones sin borrar datos
                  npm run seed    # Cargar datos de prueba
                  ```

                  ---

                  ## 📁 Estructura del Proyecto

                  ```
                  super-contable/
                  ├── client/                    # Frontend
                  │   ├── assets/
                  │   │   ├── css/              # Estilos globales y por módulo
                  │   │   ├── js/               # Lógica del cliente
                  │   │   └── uploads/          # Almacenamiento temporal (fallback)
                  │   └── views/
                  │       ├── admin/            # Panel Super Admin
                  │       ├── asistente/        # Panel Asistente
                  │       ├── auth/             # Login
                  │       └── contable/         # Panel Contable + Pre-Cierre
                  │
                  ├── server/
                  │   ├── config/               # Configuraciones
                  │   │   ├── database.js       # SQLite connection
                  │   │   ├── drive-config.js   # Google Drive settings
                  │   │   ├── jwt.js            # JWT config
                  │   │   └── env.js            # Variables de entorno
                  │   │
                  │   ├── controllers/          # Lógica de negocio
                  │   │   ├── adminController.js
                  │   │   ├── asistenteController.js
                  │   │   ├── authController.js
                  │   │   ├── contableController.js
                  │   │   └── googleAuthController.js  # OAuth Google
                  │   │
                  │   ├── services/             # Servicios externos
                  │   │   ├── telegramService.js       # Bot de Telegram
                  │   │   └── driveService.js          # Google Drive API
                  │   │
                  │   ├── routes/               # Definición de endpoints
                  │   │   ├── admin.routes.js
                  │   │   ├── asistente.routes.js
                  │   │   ├── auth.routes.js
                  │   │   └── contable.routes.js
                  │   │
                  │   ├── middleware/           # Middlewares
                  │   │   ├── auth.js           # Verificación JWT
                  │   │   ├── roles.js          # Control de permisos
                  │   │   └── errorHandler.js   # Manejo de errores
                  │   │
                  │   ├── database/             # Gestión de BD
                  │   │   ├── init-db.js        # Inicialización
                  │   │   ├── migrate.js        # Sistema de migraciones
                  │   │   ├── schema.sql        # Schema SQL
                  │   │   └── seed.js           # Datos de prueba
                  │   │
                  │   └── server.js             # Punto de entrada
                  │
                  ├── database/
                  │   └── super-contable.db     # Base de datos SQLite
                  │
                  ├── package.json              # Dependencias
                  ├── .env                      # Variables de entorno (no incluido en repo)
                  └── README.md                 # Este archivo
                  ```

                  ---

                  ## 🔐 Seguridad

                  ### Implementaciones Actuales:
                  - **JWT:** Tokens con expiración de 24 horas
                  - **Bcrypt:** Hash de contraseñas con salt rounds = 10
                  - **Helmet:** Protección contra vulnerabilidades comunes
                  - **CORS:** Lista blanca de orígenes permitidos
                  - **Rate Limiting:** 100 requests por 15 minutos por IP
                  - **Validación:** express-validator en todos los endpoints críticos
                  - **OAuth 2.0:** Refresh tokens encriptados en BD

                  ### Recomendaciones para Producción:
                  - [ ] Implementar HTTPS (Let's Encrypt)
                  - [ ] Configurar firewall en servidor
                  - [ ] Rotar JWT_SECRET periódicamente
                  - [ ] Backup automático de base de datos
                  - [ ] Monitoreo con herramientas como PM2 o Docker

                  ---

                  ## 🐛 Troubleshooting

                  ### Error: "SQLITE_LOCKED"
                  **Causa:** Múltiples procesos intentando escribir simultáneamente.  
                  **Solución:** Detener servidor con `Ctrl+C` antes de ejecutar comandos de BD.

                  ### Error: "Telegram bot not responding"
                  **Causa:** Token inválido o bot no iniciado.  
                  **Solución:** Verificar `TELEGRAM_BOT_TOKEN` en `.env` y reiniciar servidor.

                  ### Error: "Google OAuth failed"
                  **Causa:** Credenciales incorrectas o URI de redirección no autorizada.  
                  **Solución:** 
                  1. Verificar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`
                  2. En Google Cloud Console → Credenciales → Agregar URI de redirección autorizada

                  ### Imagen no carga en Dashboard
                  **Causa:** URL de Drive incorrecta o permisos insuficientes.  
                  **Solución:** Verificar que el archivo existe en Drive del contable y tiene permisos de lectura.

                  ---

                  ## 🤝 Contribuciones

                  Este es un proyecto privado en desarrollo activo. Para contribuir:

                  1. Fork el repositorio
                  2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
                  3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
                  4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
                  5. Crear Pull Request

                  ---

                  ## 📄 Licencia

                  Propiedad privada de Grupo Cassar. Todos los derechos reservados.

                  ---

                  ## 📞 Contacto

                  **Grupo Cassar**  
                  📧 administrador@grupo-cassar.com  
                  🌐 República Dominicana

                  ---

                  **Super Contable** - Transformando horas de digitación en minutos de supervisión. 🇩🇴