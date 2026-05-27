const { User } = require('./src/models');
async function run() {
  const tps = await User.findAll({ where: { position: 'Trưởng phòng' } });
  tps.forEach(tp => {
    console.log({ username: tp.username, roles: tp.roles, teamId: tp.teamId, deptId: tp.departmentId });
  });
  process.exit(0);
}
run();
