const sequelize = require('../config/database');
const User = require('./User');
const Department = require('./Department');
const ReviewPeriod = require('./ReviewPeriod');
const Template = require('./Template');
const Review = require('./Review');

// Associations
Department.hasMany(User, { foreignKey: 'departmentId' });
User.belongsTo(Department, { foreignKey: 'departmentId' });

User.hasMany(Review, { foreignKey: 'userId' });
Review.belongsTo(User, { foreignKey: 'userId' });

ReviewPeriod.hasMany(Review, { foreignKey: 'reviewPeriodId' });
Review.belongsTo(ReviewPeriod, { foreignKey: 'reviewPeriodId' });

module.exports = {
  sequelize,
  User,
  Department,
  ReviewPeriod,
  Template,
  Review
};
