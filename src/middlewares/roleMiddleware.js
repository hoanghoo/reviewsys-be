const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(403).json({ message: 'User role not found' });
    }

    const effectiveRoles = [...allowedRoles];
    if (allowedRoles.includes('Manager') || allowedRoles.includes('Employee')) {
      effectiveRoles.push('Leader');
    }

    if (!effectiveRoles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Access forbidden: Insufficient permissions' });
    }

    next();
  };
};

module.exports = { authorizeRole };
