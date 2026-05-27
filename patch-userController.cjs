const fs = require('fs');

let code = fs.readFileSync('src/controllers/userController.js', 'utf8');

const helperStr = `
const calculateRoles = (inputRoles, position, teamId, isLeadershipTeam) => {
  const rolesSet = new Set(Array.isArray(inputRoles) ? inputRoles : [inputRoles || "Employee"]);
  
  // Everyone should probably be at least Employee unless strictly only Admin
  if (rolesSet.size === 0) rolesSet.add("Employee");

  // 1. Nếu thuộc ban lãnh đạo => role: lãnh đạo
  if (isLeadershipTeam) {
    rolesSet.add("Leader");
  }

  // 2. Nếu là đội trưởng/đội phó => chỉ huy đội (Manager)
  if (position === 'Đội trưởng' || position === 'Phó đội trưởng' || position === 'Đội phó') {
    rolesSet.add("Manager");
  }

  // 3. Nếu thuộc đội 1 => thêm role: quản trị viên vào role hiện có
  if (teamId === 1 || teamId === '1') {
    rolesSet.add("Admin");
  }

  return Array.from(rolesSet);
};
`;

// Insert helper before getAllUsers
code = code.replace(/const getAllUsers = /, helperStr + '\nconst getAllUsers = ');

// In createUser
const createRolesOld = `const dbRoles = Array.isArray(req.body.roles) ? req.body.roles : [req.body.role || "Employee"];`;
const createRolesNew = `const dbRoles = calculateRoles(req.body.roles, position, teamId, isLeadershipTeam);`;
code = code.replace(createRolesOld, createRolesNew);

// Remove the old fallback in createUser
const oldFallback = `    if (userWithoutPassword.teamId === 1) {
      if (!userWithoutPassword.roles) userWithoutPassword.roles = []; if (!userWithoutPassword.roles.includes("Admin")) userWithoutPassword.roles.push("Admin");
    } else if (userWithoutPassword.teamId === 7) {
      if (!userWithoutPassword.roles) userWithoutPassword.roles = []; if (!userWithoutPassword.roles.includes("Leader")) userWithoutPassword.roles.push("Leader");
    }`;
code = code.replace(oldFallback, '');

// In updateUser
const updateRolesOld = `const dbRoles = Array.isArray(req.body.roles) ? req.body.roles : [req.body.role || "Employee"];`;
const updateRolesNew = `const dbRoles = calculateRoles(req.body.roles, position, teamId, isLeadershipTeam);`;
code = code.replace(updateRolesOld, updateRolesNew);

// In importSubmit
const importRolesOld = `      let roles = ["Employee"];
      if (u.position === 'Đội trưởng' || u.position === 'Phó đội trưởng') {
        roles.push("Manager");
      } else if (u.position === 'Trưởng phòng' || u.position === 'Phó phòng') {
        roles.push("Leader");
      }`;
const importRolesNew = `      let roles = calculateRoles(["Employee"], u.position, u.teamId, u.teamName === 'Ban Lãnh đạo');`;
code = code.replace(importRolesOld, importRolesNew);

fs.writeFileSync('src/controllers/userController.js', code);
console.log('userController.js patched');
