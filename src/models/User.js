const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('Admin', 'Manager', 'Employee'),
    defaultValue: 'Employee',
  },
  rank: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  teamId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  departmentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
}, {
  timestamps: true,
});

// Associations are defined in models/index.js

module.exports = User;
