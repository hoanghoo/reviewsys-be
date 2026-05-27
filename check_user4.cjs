const { User, Review, Team } = require('./src/models');

async function check() {
  const u = await User.findByPk(4, { include: [{ model: Team }] });
  console.log(`User 4: ${u.fullName}, TeamId: ${u.teamId}, Team Name: ${u.Team?.shortName}`);
}
check().catch(console.error).finally(() => process.exit(0));
