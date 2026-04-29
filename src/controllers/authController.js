const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

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
      process.env.JWT_SECRET || 'secret123',
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

const initAdmin = async (req, res) => {
  try {
    const count = await User.count();
    if (count > 0) {
      return res.status(400).json({ message: 'Admin already initialized' });
    }
    
    const hashedPassword = bcrypt.hashSync('admin123', 8);
    const admin = await User.create({
      username: 'admin',
      password: hashedPassword,
      fullName: 'System Administrator',
      role: 'Admin'
    });

    res.status(201).json({ message: 'Admin user created successfully', user: admin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { login, initAdmin };
