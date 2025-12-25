require('dotenv').config();

const requiredEnvVars = [
  'JWT_SECRET',
  'DB_PATH'
];

const optionalEnvVars = [
  'NODE_ENV',
  'PORT',
  'MINDEE_API_KEY',
  'GOOGLE_DRIVE_CLIENT_ID',
  'TELEGRAM_BOT_TOKEN'
];

function validateEnv() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in the required values.'
    );
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  database: {
    path: process.env.DB_PATH
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10
  },

  mindee: {
    apiKey: process.env.MINDEE_API_KEY
  },

  googleDrive: {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI,
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL
  },

  client: {
    url: process.env.CLIENT_URL || 'http://localhost:3000'
  },

  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  }
};

module.exports = { config, validateEnv };
