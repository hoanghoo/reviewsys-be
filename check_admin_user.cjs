const { User, Team } = require('./src/models');
async function check() {
  const u = await User.findOne({ where: { username: 'admin' }, include: [Team] });
  if (u) {
    console.log(`Username: ${u.username}, Role: ${u.role}, Roles: ${u.roles}, Team: ${u.Team?.shortName} (ID: ${u.teamId}), Rank: ${u.rank}, Position: ${u.position}`);
  } else {
    console.log('User admin not found');
  }
}
check().catch(console.error).finally(() => process.exit(0));
