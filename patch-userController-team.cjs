const fs = require('fs');
let code = fs.readFileSync('src/controllers/userController.js', 'utf8');

// Patch calculateRoles to also take isTeam1
code = code.replace(
  'const calculateRoles = (inputRoles, position, teamId, isLeadershipTeam) => {',
  'const calculateRoles = (inputRoles, position, teamId, isLeadershipTeam, isTeam1) => {'
);
code = code.replace(
  'if (teamId === 1 || teamId === \'1\') {',
  'if (teamId === 1 || teamId === \'1\' || isTeam1) {'
);

// Patch getAllUsers mapping
code = code.replace(
  'if (json.teamId === 1) {',
  'if (json.teamId === 1 || (u.Team && u.Team.shortName === \'Đội 1\')) {'
);

// Patch createUser
const createUserOld = `    let isLeadershipTeam = false;
    if (teamId) {
      const team = await Team.findByPk(teamId);
      if (team && (team.shortName === 'Ban Lãnh đạo' || team.id === 7)) {
        isLeadershipTeam = true;
      }
    }`;
const createUserNew = `    let isLeadershipTeam = false;
    let isTeam1 = false;
    if (teamId) {
      const team = await Team.findByPk(teamId);
      if (team && (team.shortName === 'Ban Lãnh đạo' || team.id === 7)) {
        isLeadershipTeam = true;
      }
      if (team && (team.shortName === 'Đội 1' || team.id === 1)) {
        isTeam1 = true;
      }
    }`;
code = code.replace(createUserOld, createUserNew);
code = code.replace(
  'const dbRoles = calculateRoles(req.body.roles, position, teamId, isLeadershipTeam);',
  'const dbRoles = calculateRoles(req.body.roles, position, teamId, isLeadershipTeam, isTeam1);'
);

// Patch updateUser
const updateUserOld = `    let isLeadershipTeam = false;
    if (teamId) {
      const team = await Team.findByPk(teamId);
      if (team && (team.shortName === 'Ban Lãnh đạo' || team.id === 7)) {
        isLeadershipTeam = true;
      }
    }`;
code = code.replace(updateUserOld, createUserNew); // Same logic
code = code.replace(
  'if (userWithoutPassword.teamId === 1) {',
  'if (userWithoutPassword.teamId === 1 || (teamId && isTeam1)) {'
);

// Patch importUsers
code = code.replace(
  'let roles = calculateRoles(["Employee"], u.position, u.teamId, u.teamName === \'Ban Lãnh đạo\');',
  'let roles = calculateRoles(["Employee"], u.position, u.teamId, u.teamName === \'Ban Lãnh đạo\', u.teamName === \'Đội 1\');'
);

fs.writeFileSync('src/controllers/userController.js', code);
console.log('userController.js patched for Team 1');
