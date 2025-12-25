function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
}

function requireSuperAdmin(req, res, next) {
  return requireRole('super_admin')(req, res, next);
}

function requireContable(req, res, next) {
  return requireRole('super_admin', 'contable')(req, res, next);
}

function requireAsistente(req, res, next) {
  return requireRole('super_admin', 'contable', 'asistente')(req, res, next);
}

module.exports = {
  requireRole,
  requireSuperAdmin,
  requireContable,
  requireAsistente
};
