const { User } = require('./src/models');
async function check() {
  const u = await User.findOne({ where: { username: 'admin' } });
  if (u) {
    u.teamId = 1;
    await u.save();
    console.log('Admin user updated with teamId = 1');
  }
}
check().catch(console.error).finally(() => process.exit(0));
