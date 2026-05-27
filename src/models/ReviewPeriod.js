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
  monthYear: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
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
  },
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  teamIds: {
    type: DataTypes.JSON,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('teamIds');
      if (typeof rawValue === 'string') {
        try { return JSON.parse(rawValue); } catch (e) { return rawValue; }
      }
      return rawValue;
    }
  }
}, {
  timestamps: true,
});

module.exports = ReviewPeriod;
