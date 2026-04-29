const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  reviewPeriodId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reviewerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  revieweeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Submitted', 'Reviewed'),
    defaultValue: 'Draft',
  },
  score: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  feedback: {
    type: DataTypes.TEXT,
    allowNull: true,
  }
}, {
  timestamps: true,
});

module.exports = Review;
