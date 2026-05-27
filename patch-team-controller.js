const fs = require('fs');
const path = './src/controllers/teamController.js';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('console.log("assignLeader req.body:", JSON.stringify(req.body, null, 2));')) {
  code = code.replace(
    'exports.assignLeader = async (req, res) => {',
    'exports.assignLeader = async (req, res) => {\n  console.log("assignLeader req.body:", JSON.stringify(req.body, null, 2));'
  );
  fs.writeFileSync(path, code);
  console.log('Patched teamController.js');
} else {
  console.log('Already patched');
}
