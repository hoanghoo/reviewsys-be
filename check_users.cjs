const { User, Team } = require('./src/models');
async function check() {
  const users = await User.findAll({ 
    include: [Team] 
  });
  const adminUsers = users.filter(u => u.username.toLowerCase().includes('admin') || u.fullName.toLowerCase().includes('admin'));
  for (let u of adminUsers) {
    console.log(`ID: ${u.id}, Username: ${u.username}, FullName: ${u.fullName}, Team: ${u.Team?.shortName} (ID: ${u.teamId}), Role: ${u.role}, Roles: ${u.roles}`);
  }
}
check().catch(console.error).finally(() => process.exit(0));
