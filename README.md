# 📊 Super Contable - MVP Fase 1

Plataforma SaaS multi-tenant de gestión contable automatizada con IA para República Dominicana.

## 🎯 Descripción

Super Contable permite que firmas contables escalen su negocio automatizando la digitación de facturas mediante OCR (Mindee) + Telegram Bot. Transforma 8 horas de digitación manual en 2 horas de supervisión.

## 🏗️ Stack Tecnológico

- **Backend:** Node.js + Express
- **Database:** SQLite (migrar a PostgreSQL después)
- **Frontend:** Vanilla JavaScript
- **OCR:** Mindee (Fase 2)
- **Storage:** Google Drive API (Fase 2)
- **Input:** Telegram Bot (Fase 2)
- **Auth:** JWT

## 📦 Instalación

### Prerrequisitos

- Node.js >= 18.0.0
- npm >= 9.0.0

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd super-contable
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar el archivo `.env` y configurar las variables necesarias:
```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_PATH=./database/super-contable.db

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# (Otras variables para Fase 2)
```

4. **Inicializar la base de datos**
```bash
npm run init-db
```

5. **Poblar con datos de prueba**
```bash
npm run seed
```

6. **Iniciar el servidor**
```bash
npm start
```

O en modo desarrollo con auto-reload:
```bash
npm run dev
```

El servidor estará disponible en: `http://localhost:3000`

## 👥 Cuentas de Prueba

Después de ejecutar `npm run seed`, puedes usar estas cuentas:

| Rol | Email | Password |
|-----|-------|----------|
| Super Admin | admin@supercontable.com | admin123 |
| Contable | juan@contable.com | contable123 |
| Asistente | maria@asistente.com | asistente123 |

## 🎭 Roles y Permisos

### Super Admin
- Gestión global del sistema
- Crear/editar/eliminar contables
- Ver métricas globales
- Acceso completo

### Contable
- Gestionar empresas clientes
- Crear asistentes
- Supervisar facturas de sus empresas
- Ver reportes de su cartera

### Asistente
- Validar facturas de empresas asignadas
- Editar información de facturas
- Aprobar/rechazar facturas
- Sin acceso a gestión de empresas

## 📁 Estructura del Proyecto

```
super-contable/
├── client/                 # Frontend
│   ├── assets/
│   │   ├── css/           # Estilos
│   │   ├── js/            # JavaScript
│   │   └── images/        # Imágenes
│   └── views/             # HTML
│       ├── auth/          # Login
│       ├── admin/         # Panel Admin
│       ├── contable/      # Panel Contable
│       └── asistente/     # Panel Asistente
│
├── server/                # Backend
│   ├── config/           # Configuración
│   ├── database/         # SQL y migrations
│   ├── middleware/       # Auth, roles, errors
│   ├── models/          # User, Empresa, Factura
│   ├── routes/          # Express routes
│   ├── controllers/     # Lógica de negocio
│   ├── services/        # Servicios externos
│   └── server.js        # Punto de entrada
│
└── database/            # SQLite database
```

## 🔌 API Endpoints

### Autenticación
```
POST   /api/auth/login      # Iniciar sesión
GET    /api/auth/verify     # Verificar token
POST   /api/auth/logout     # Cerrar sesión
```

### Admin (Super Admin)
```
GET    /api/admin/dashboard           # Métricas globales
GET    /api/admin/contables           # Listar contables
POST   /api/admin/contables           # Crear contable
PUT    /api/admin/contables/:id       # Editar contable
DELETE /api/admin/contables/:id       # Eliminar contable
```

### Contable
```
GET    /api/contable/dashboard        # Dashboard del contable
GET    /api/contable/empresas         # Listar empresas
POST   /api/contable/empresas         # Crear empresa
PUT    /api/contable/empresas/:id     # Editar empresa
GET    /api/contable/facturas         # Listar facturas
GET    /api/contable/asistentes       # Listar asistentes
POST   /api/contable/asistentes       # Crear asistente
```

### Asistente
```
GET    /api/asistente/dashboard       # Dashboard del asistente
GET    /api/asistente/facturas        # Listar facturas asignadas
PUT    /api/asistente/facturas/:id    # Editar factura
POST   /api/asistente/facturas/:id/aprobar   # Aprobar factura
POST   /api/asistente/facturas/:id/rechazar  # Rechazar factura
POST   /api/asistente/aprobar-lote    # Aprobar múltiples
```

## 🗄️ Base de Datos

### Tablas Principales

- **users** - Usuarios del sistema (Super Admin, Contable, Asistente)
- **empresas** - Clientes del contable
- **telegram_users** - Usuarios finales de Telegram
- **facturas** - Facturas digitalizadas
- **asistente_empresas** - Asignación empresas → asistentes
- **audit_log** - Registro de auditoría
- **exportaciones** - Historial de exportaciones

## 🔐 Seguridad

- Autenticación mediante JWT
- Passwords hasheados con bcryptjs (10 rounds)
- Middleware de autorización por roles
- Validación de permisos multi-tenant
- CORS configurado
- Helmet para headers de seguridad
- Rate limiting

## 🧪 Testing

Actualmente en desarrollo. Para probar manualmente:

1. Iniciar servidor
2. Abrir navegador en `http://localhost:3000`
3. Login con cuentas de prueba
4. Navegar por los diferentes dashboards

## 📝 Scripts Disponibles

```bash
npm start          # Iniciar servidor
npm run dev        # Modo desarrollo (con nodemon)
npm run init-db    # Inicializar base de datos
npm run seed       # Poblar con datos de prueba
```

## 🚀 Roadmap

### ✅ Fase 1 - MVP Básico (COMPLETADA)
- [x] Autenticación y autorización
- [x] CRUD de usuarios (Admin, Contable, Asistente)
- [x] CRUD de empresas
- [x] CRUD de facturas
- [x] Dashboards básicos
- [x] Sistema multi-tenant

### 🔄 Fase 2 - Automatización (Siguiente)
- [ ] Integración con Mindee OCR
- [ ] Bot de Telegram para recepción de facturas
- [ ] Integración con Google Drive
- [ ] Procesamiento automático de imágenes
- [ ] Exportación a Excel

### 📅 Fase 3 - Optimización
- [ ] Migración a PostgreSQL
- [ ] Sistema de reportes avanzados
- [ ] Notificaciones en tiempo real
- [ ] Panel de analytics
- [ ] API pública

## 🤝 Contribuir

Este es un proyecto en desarrollo activo. Para contribuir:

1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

MIT License

## 👨‍💻 Soporte

Para soporte, contactar al equipo de desarrollo.

---

**Super Contable** - Automatizando la contabilidad dominicana 🇩🇴