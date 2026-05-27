const { User, Team } = require('./src/models');
async function fixRoles() {
  const users = await User.findAll({ include: [Team] });
  for (let u of users) {
    let roles = Array.isArray(u.roles) ? [...u.roles] : (u.roles ? [u.roles] : ['Employee']);
    if (!roles.includes('Employee')) roles.push('Employee');
    
    if (u.teamId === 1 || (u.Team && u.Team.shortName === 'Đội 1')) {
      if (!roles.includes('Admin')) roles.push('Admin');
    }
    if (u.teamId === 7 || (u.Team && u.Team.shortName === 'Ban Lãnh đạo')) {
      if (!roles.includes('Leader')) roles.push('Leader');
    }
    if (u.position === 'Đội trưởng' || u.position === 'Đội phó') {
      if (!roles.includes('Manager')) roles.push('Manager');
    }
    
    // Check if roles array changed
    const originalRolesStr = JSON.stringify(u.roles);
    const newRolesStr = JSON.stringify(roles);
    if (originalRolesStr !== newRolesStr) {
      u.roles = roles;
      await u.save();
      console.log(`Updated roles for ${u.fullName}: ${newRolesStr}`);
    }
  }
  console.log('Roles update complete.');
}
fixRoles().catch(console.error).finally(() => process.exit(0));
