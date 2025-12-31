const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { config } = require('../config/env');

/**
 * Lógica de Autenticación (Sincronizada con Schema Final: password y role)
 */

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email y contraseña son obligatorios'
    });
  }

  // Buscamos al usuario por email
  const user = await User.findByEmail(email);

  // 1. Si el usuario no existe
  if (!user) {
    console.log(`❌ Login fallido: Usuario ${email} no existe.`);
    return res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }

  // 2. Identificar la columna de contraseña (compatibilidad total)
  // En el nuevo esquema es 'user.password', en el viejo era 'user.password_hash'
  const hashEnDB = user.password || user.password_hash; 
  
  if (!hashEnDB) {
    console.error(`❌ Error Crítico: El usuario ${email} no tiene password definido en la DB.`);
    return res.status(500).json({
      success: false,
      message: 'Error de integridad en la base de datos'
    });
  }

  // 3. Comparar contraseña enviada con el hash de la DB
  const esValida = await bcrypt.compare(password, hashEnDB);

  if (!esValida) {
    console.log(`❌ Login fallido: Contraseña incorrecta para ${email}.`);
    return res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }

  // 4. Generación de Token JWT (Aseguramos que 'role' exista)
  const userRole = user.role || user.rol || 'contable';

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: userRole
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  console.log(`✅ Sesión iniciada: ${user.email} (${userRole})`);

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: userRole,
        nombre_completo: user.email.split('@')[0]
      }
    }
  });
});

const verify = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Usuario no encontrado'
    });
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      role: user.role || user.rol,
      drive_connected: !!user.drive_refresh_token,
      nombre_completo: user.email.split('@')[0]
    }
  });
});

const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Sesión cerrada correctamente'
  });
});

module.exports = {
  login,
  verify,
  logout
};