const fs = require('fs');
const path = './src/controllers/userController.js';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('console.log("updateUser req.body:", JSON.stringify(req.body, null, 2));')) {
  code = code.replace(
    'const updateUser = async (req, res) => {',
    'const updateUser = async (req, res) => {\n  console.log("updateUser req.body:", JSON.stringify(req.body, null, 2));'
  );
  fs.writeFileSync(path, code);
  console.log('Patched userController.js');
} else {
  console.log('Already patched');
}
