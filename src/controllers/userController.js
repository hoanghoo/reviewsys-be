const { User, Department, Team } = require('../models');
const bcrypt = require('bcryptjs');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Team, attributes: ['id', 'shortName', 'fullName'] }
      ]
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, fullName, role, departmentId, rank, position, teamId } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);
    const user = await User.create({
      username, password: hashedPassword, fullName, role, departmentId, rank, position, teamId
    });
    
    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { fullName, role, departmentId, password, rank, position, teamId } = req.body;
    
    const updateData = { fullName, role, departmentId, rank, position, teamId };
    if (password) {
      updateData.password = bcrypt.hashSync(password, 8);
    }

    await user.update(updateData);
    
    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await user.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Team, attributes: ['id', 'shortName', 'fullName'] }
      ]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const userJSON = user.toJSON();
    
    if (user.teamId) {
      const manager = await User.findOne({
        where: { teamId: user.teamId, role: 'Manager' },
        attributes: ['fullName']
      });
      if (manager) {
        userJSON.managerName = manager.fullName;
      }
    }
    
    res.status(200).json(userJSON);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = bcrypt.compareSync(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác' });
    }

    user.password = bcrypt.hashSync(newPassword, 8);
    await user.save();

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAllUsers, createUser, updateUser, deleteUser, getProfile, changePassword };
