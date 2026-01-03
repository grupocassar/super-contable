require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./config/database');
const { initTelegramBot, getBot } = require('./services/telegramService');
const { initWorker } = require('./services/workerService');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const contableRoutes = require('./routes/contable.routes');
const asistenteRoutes = require('./routes/asistente.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// --- MIDDLEWARES GLOBALES ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- SILENCIADOR DE FAVICON (Elimina el error 404 en consola) ---
app.get('/favicon.ico', (req, res) => res.status(204).end());

// --- RUTAS DE LA API ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contable', contableRoutes);
app.use('/api/asistente', asistenteRoutes);

// Servir archivos estáticos del frontend (CSS, JS, Imágenes)
app.use(express.static(path.join(__dirname, '../client')));

/**
 * ✅ RUTA RAÍZ PROFESIONAL
 * Ahora sirve la Landing Page comercial con los planes actualizados.
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

/**
 * ✅ RUTA DE ACCESO A LA APP
 * Mantenemos un acceso directo al login si se requiere navegar manualmente.
 */
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/views/auth/login.html'));
});

// Manejo de errores (Debe ir al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1. Inicializar Base de Datos
    await initDatabase();
    
    // 2. Inicializar Bot de Telegram
    initTelegramBot();
    
    // 3. Inicializar Worker (procesamiento en segundo plano)
    const bot = getBot();
    if (bot) {
      initWorker(bot);
    } else {
      console.warn('⚠️ Worker no iniciado: Bot de Telegram no disponible');
    }
    
    // 4. Arrancar Servidor
    app.listen(PORT, () => {
      console.log(`
✓ Connected to SQLite database
🤖 Super Contable Bot: ONLINE
⚙️ Worker Service: ONLINE (Procesando cola cada 5s)
🚀 Super Contable Server Started!
   Port: ${PORT}
   URL: http://localhost:${PORT}
      `);
    });
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error.message);
    process.exit(1);
  }
}

startServer();