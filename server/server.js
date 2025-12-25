require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./config/database');
const { validateEnv, config } = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const { requireRole } = require('./middleware/roles');

// Routes
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const contableRoutes = require('./routes/contable.routes');
const asistenteRoutes = require('./routes/asistente.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/assets', express.static(path.join(__dirname, '../client/assets')));
app.use('/views', express.static(path.join(__dirname, '../client/views')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authenticateToken, requireRole(['super_admin']), adminRoutes);
app.use('/api/contable', authenticateToken, requireRole(['contable', 'super_admin']), contableRoutes);
app.use('/api/asistente', authenticateToken, requireRole(['asistente', 'contable', 'super_admin']), asistenteRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/views/auth/login.html'));
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    validateEnv();
    await initDatabase();

    const port = config.server.port;

    app.listen(port, () => {
      console.log('\n🚀 Super Contable Server Started!\n');
      console.log(`   Environment:  ${config.server.env}`);
      console.log(`   Port:         ${port}`);
      console.log(`   URL:          http://localhost:${port}`);
      console.log(`   Database:     ${config.database.path}\n`);
      console.log('✓ Server is ready to accept connections\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

module.exports = app;