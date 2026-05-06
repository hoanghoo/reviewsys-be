const sequelize = require('../config/database');
const User = require('./User');
const Department = require('./Department');
const ReviewPeriod = require('./ReviewPeriod');
const Template = require('./Template');
const Review = require('./Review');
const Team = require('./team');

// === Associations ===

// Department - User
Department.hasMany(User, { foreignKey: 'departmentId' });
User.belongsTo(Department, { foreignKey: 'departmentId' });

// Team - User
Team.hasMany(User, { foreignKey: 'teamId' });
User.belongsTo(Team, { foreignKey: 'teamId' });

// ReviewPeriod - Review
ReviewPeriod.hasMany(Review, { as: 'Reviews', foreignKey: 'reviewPeriodId' });
Review.belongsTo(ReviewPeriod, { foreignKey: 'reviewPeriodId' });

// User - Review (as reviewer)
User.hasMany(Review, { as: 'ReviewsGiven', foreignKey: 'reviewerId' });
Review.belongsTo(User, { as: 'Reviewer', foreignKey: 'reviewerId' });

// User - Review (as reviewee)
User.hasMany(Review, { as: 'ReviewsReceived', foreignKey: 'revieweeId' });
Review.belongsTo(User, { as: 'Reviewee', foreignKey: 'revieweeId' });

// Template - Review
Template.hasMany(Review, { foreignKey: 'templateId' });
Review.belongsTo(Template, { foreignKey: 'templateId' });

// Template - ReviewPeriod
Template.hasMany(ReviewPeriod, { foreignKey: 'templateId' });
ReviewPeriod.belongsTo(Template, { foreignKey: 'templateId' });

module.exports = {
  sequelize,
  User,
  Department,
  ReviewPeriod,
  Template,
  Review,
  Team
};
