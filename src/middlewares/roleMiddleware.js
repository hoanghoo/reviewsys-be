const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRoles || req.userRoles.length === 0) {
      return res.status(403).json({ message: 'User roles not found' });
    }

    const effectiveRoles = [...allowedRoles];
    if (allowedRoles.includes('Manager') || allowedRoles.includes('Employee')) {
      effectiveRoles.push('Leader');
    }

    const hasPermission = req.userRoles.some(role => effectiveRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access forbidden: Insufficient permissions' });
    }

    next();
  };
};

module.exports = { authorizeRole };
