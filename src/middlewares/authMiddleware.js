const jwt = require('jsonwebtoken');
const { User, Team } = require('../models');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(403).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Token format is invalid' });

  const secret = process.env.JWT_SECRET || 'iprs-dev-secret-change-me';
  
  jwt.verify(token, secret, async (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    
    try {
      const user = await User.findByPk(decoded.id, {
        include: [{ model: Team }]
      });
      if (!user) return res.status(401).json({ message: 'Unauthorized' });
      
      let roles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : ['Employee']);
      
      // Dynamic Role Enforcement
      if (user.Team) {
        if (user.Team.shortName === 'Đội 1' || user.teamId === 1 || user.teamId === '1') {
          if (!roles.includes('Admin')) roles.push('Admin');
        }
        if (user.Team.shortName === 'Ban Lãnh đạo' || user.teamId === 7 || user.teamId === '7') {
          if (!roles.includes('Leader')) roles.push('Leader');
        }
      }
      // Also enforce Manager role dynamically
      if (user.position === 'Đội trưởng' || user.position === 'Đội phó') {
        if (!roles.includes('Manager')) roles.push('Manager');
      }
      
      
      req.userId = user.id;
      req.userRoles = roles;
      req.userRole = roles[0] || 'Employee'; // Fallback
      req.user = { 
        id: user.id, 
        roles: roles,
        role: roles[0] || 'Employee', // Fallback 
        teamId: user.teamId, 
        departmentId: user.departmentId,
        fullName: user.fullName,
        position: user.position,
        managedTeamIds: user.managedTeamIds
      };
      
      next();
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
};

module.exports = { verifyToken };
