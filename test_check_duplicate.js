const { User, Team } = require('./src/models');

async function run() {
  const teams = await Team.findAll();
  for (const team of teams) {
    const members = await User.findAll({
      where: { teamId: team.id },
      order: [['fullName', 'ASC']]
    });
    const names = members.map(m => m.fullName);
    const duplicates = names.filter((e, i, a) => a.indexOf(e) !== i);
    if (duplicates.length > 0) {
      console.log(`Team ${team.id} (${team.name}) has duplicates:`, duplicates);
    }
  }
  
  // also check department
  const depts = [1, 2, 3]; // whatever
  for (const deptId of depts) {
    const members = await User.findAll({
      where: { departmentId: deptId },
      order: [['fullName', 'ASC']]
    });
    const names = members.map(m => m.fullName);
    const duplicates = names.filter((e, i, a) => a.indexOf(e) !== i);
    if (duplicates.length > 0) {
      console.log(`Dept ${deptId} has duplicates:`, duplicates);
    }
  }
}
run().catch(console.error);
