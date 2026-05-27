const { User, Review } = require('./src/models');
async function run() {
  const tp = await User.findOne({ where: { position: 'Trưởng phòng' } });
  console.log("Trưởng phòng:", tp ? { username: tp.username, roles: tp.roles, departmentId: tp.departmentId } : "None");
  
  const comp = await Review.findOne({ where: { status: 'Completed' } });
  const reviewee = await User.findByPk(comp.revieweeId);
  console.log("Completed reviewee:", { username: reviewee.username, departmentId: reviewee.departmentId, teamId: reviewee.teamId });
  process.exit(0);
}
run();
