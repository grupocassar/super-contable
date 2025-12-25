const User = require('../models/User');
const { generateToken } = require('../config/jwt');
const { asyncHandler } = require('../middleware/errorHandler');

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

  if (!user.activo) {
    return res.status(403).json({
      success: false,
      message: 'Account is inactive'
    });
  }

  const isValidPassword = await User.verifyPassword(password, user.password_hash);

  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    rol: user.rol,
    contableId: user.contable_id
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        contable_id: user.contable_id
      }
    }
  });
});

const verify = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);

  if (!user || !user.activo) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        contable_id: user.contable_id
      }
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
