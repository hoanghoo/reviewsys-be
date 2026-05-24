const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('Word', 'Excel'),
    allowNull: false,
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileData: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  }
}, {
  timestamps: true,
});

module.exports = Template;
