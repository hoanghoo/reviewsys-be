const jwt = require('jsonwebtoken');
const { User } = require('../models');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Token format is invalid' });

  const secret = process.env.JWT_SECRET || 'iprs-dev-secret-change-me';
  
  jwt.verify(token, secret, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    
    // Set for compatibility
    req.userId = decoded.id;
    req.userRole = decoded.role;
    req.user = { id: decoded.id, role: decoded.role };
    
    next();
  });
};

module.exports = { verifyToken };
