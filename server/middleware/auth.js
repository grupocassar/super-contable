const jwt = require('jsonwebtoken');

// Intentamos cargar la config, si falla usamos process.env (fallback seguro)
let secret = process.env.JWT_SECRET;
try {
    const { config } = require('../config/env');
    if (config && config.jwt && config.jwt.secret) secret = config.jwt.secret;
} catch (e) {
    console.warn('⚠️ No se encontró config/env, usando process.env.JWT_SECRET');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Soporta tanto "Bearer TOKEN" como el token directo
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, secret || process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();
  });
};

// Alias: protect es lo mismo que authenticateToken (para compatibilidad con nuevas rutas)
const protect = authenticateToken;

// Middleware para verificar roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Rol no autorizado: ${req.user.role}` 
      });
    }
    next();
  };
};

module.exports = { authenticateToken, protect, authorize };