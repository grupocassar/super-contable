const { verifyToken } = require('../config/jwt');

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    const decoded = verifyToken(token);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      rol: decoded.rol,
      contableId: decoded.contableId || null
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

module.exports = { authenticate };
