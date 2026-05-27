const fs = require('fs');
let code = fs.readFileSync('src/controllers/reviewController.js', 'utf8');

const oldCode = `    const { Op } = require('sequelize');
    let userWhere = { 
      role: { [Op.in]: ['Employee', 'Manager', 'Admin'] } // Include all roles for testing/tracking
    };`;

const newCode = `    const { Op } = require('sequelize');
    let userWhere = {};`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/controllers/reviewController.js', code);
console.log('reviewController.js patched');
