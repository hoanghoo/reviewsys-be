const { User, Review, Team, ReviewPeriod } = require('./src/models');
const { Op } = require('sequelize');
async function run() {
  const period = await ReviewPeriod.findOne({ where: { id: 6 } }) || await ReviewPeriod.findOne();
  let userWhere = {};
  if (Array.isArray(period.teamIds) && period.teamIds.length > 0) {
    userWhere.teamId = { [Op.in]: period.teamIds };
  }
  let reviewWhere = { reviewPeriodId: period.id };
  const status = 'Reviewed';
  if (status === 'Reviewed' || status === 'Completed') {
    reviewWhere.status = { [Op.in]: ['Reviewed', 'Completed'] };
  }
  
  const { count, rows: users } = await User.findAndCountAll({
    where: userWhere,
    include: [
      {
        model: Review,
        as: 'ReviewsReceived',
        where: reviewWhere,
        required: true,
        include: [{ model: User, as: 'Reviewer', attributes: ['id', 'fullName'] }]
      },
      {
        model: Team,
        attributes: ['id', 'shortName', 'fullName']
      }
    ],
    limit: 10,
    offset: 0,
    distinct: true,
    order: [['fullName', 'ASC']],
  });
  console.log("Count:", count);
  console.log("Users returned:", users.length);
  process.exit(0);
}
run();
