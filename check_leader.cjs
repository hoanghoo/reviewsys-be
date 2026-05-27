const { User, Team } = require('./src/models');
async function check() {
  const users = await User.findAll({ where: { position: 'Trưởng phòng' }, include: [Team] });
  for (let u of users) {
    console.log(`FullName: ${u.fullName}, Team: ${u.Team?.shortName} (ID: ${u.teamId}), Roles: ${JSON.stringify(u.roles)}`);
  }
}
check().catch(console.error).finally(() => process.exit(0));
