const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');
const { config } = require('../config/env');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  const user = await User.findByEmail(email);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      rol: user.rol
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre_completo: user.nombre_completo,
        rol: user.rol
      }
    }
  });
});

const verify = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      nombre_completo: user.nombre_completo,
      rol: user.rol
    }
  });
});

const logout = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = {
  login,
  verify,
  logout
};