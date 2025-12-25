const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { config, validateEnv } = require('./config/env');
const { initDatabase } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const contableRoutes = require('./routes/contable.routes');
const asistenteRoutes = require('./routes/asistente.routes');

const app = express();

validateEnv();

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: config.client.url,
  credentials: true
}));

if (config.env === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contable', contableRoutes);
app.use('/api/asistente', asistenteRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/views/auth/login.html'));
});

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    await initDatabase();

    const server = app.listen(config.port, () => {
      console.log('\n🚀 Super Contable Server Started!\n');
      console.log(`   Environment:  ${config.env}`);
      console.log(`   Port:         ${config.port}`);
      console.log(`   URL:          http://localhost:${config.port}`);
      console.log(`   Database:     ${config.database.path}\n`);
      console.log('✓ Server is ready to accept connections\n');
    });

    const shutdown = async () => {
      console.log('\n⚠️  Shutting down gracefully...');
      server.close(() => {
        console.log('✓ Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
