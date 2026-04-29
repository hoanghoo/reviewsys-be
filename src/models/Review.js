const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reviewPeriodId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  selfScore: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  managerScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Submitted', 'Approved', 'Rejected'),
    defaultValue: 'Draft',
  },
  reviewData: {
    type: DataTypes.JSON, // To store the form details
    allowNull: true,
  }
}, {
  timestamps: true,
});

module.exports = Review;
