const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

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

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid Password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET || 'iprs-dev-secret-change-me',
      { expiresIn: 86400 } // 24 hours
    );

    res.status(200).json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      accessToken: token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { login };
