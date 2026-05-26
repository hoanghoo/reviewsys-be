const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Team } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set in .env. Using fallback (unsafe for production).');
}

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ 
      where: { username },
      include: [{ model: Team }]
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid Password' });
    }

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
    
    

    const token = jwt.sign(
      { id: user.id, roles: roles },
      JWT_SECRET || 'iprs-dev-secret-change-me',
      { expiresIn: 86400 } // 24 hours
    );

    res.status(200).json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roles: roles,
      role: roles[0] || 'Employee', // Provide primary role for backward compatibility in some places
      position: user.position,
      rank: user.rank,
      teamId: user.teamId,
      departmentId: user.departmentId,
      accessToken: token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { login };
