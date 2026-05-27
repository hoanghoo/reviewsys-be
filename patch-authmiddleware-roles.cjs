const fs = require('fs');
let code = fs.readFileSync('src/middlewares/authMiddleware.js', 'utf8');

const oldRoles = `      let roles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : ['Employee']);`;

const newRoles = `      let roles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : ['Employee']);
      
      // Dynamic Role Enforcement
      if (user.Team) {
        if (user.Team.shortName === 'Đội 1' || user.teamId === 1 || user.teamId === '1') {
          if (!roles.includes('Admin')) roles.push('Admin');
        }
        if (user.Team.shortName === 'Ban Lãnh đạo' || user.teamId === 7 || user.teamId === '7') {
          if (!roles.includes('Leader')) roles.push('Leader');
        }
      }
      // Also enforce Manager role dynamically
      if (user.position === 'Đội trưởng' || user.position === 'Đội phó') {
        if (!roles.includes('Manager')) roles.push('Manager');
      }`;

code = code.replace(oldRoles, newRoles);
fs.writeFileSync('src/middlewares/authMiddleware.js', code);
console.log('authMiddleware.js patched');
