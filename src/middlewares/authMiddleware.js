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
      
      let role = user.role;
      if (user.teamId === 1) {
        role = 'Admin';
      } else if (user.teamId === 7 || (user.Team && user.Team.shortName === 'Ban Lãnh đạo')) {
        role = 'Leader';
      }
      
      req.userId = user.id;
      req.userRole = role;
      req.user = { 
        id: user.id, 
        role: role, 
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
