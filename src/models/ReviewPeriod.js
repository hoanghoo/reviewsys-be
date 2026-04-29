const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReviewPeriod = sequelize.define('ReviewPeriod', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Open', 'Closed'),
    defaultValue: 'Open',
  }
}, {
  timestamps: true,
});

module.exports = ReviewPeriod;
