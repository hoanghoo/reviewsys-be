require('dotenv').config({ path: '.env.development' });
const userController = require('./src/controllers/userController');

(async () => {
  const req = {};
  const res = {
    json: (data) => {
      const phophong = data.find(u => u.position === 'Phó phòng' || u.position === 'Phó trưởng phòng');
      console.log('phophong.managedTeamIds:', phophong.managedTeamIds);
      console.log('isArray:', Array.isArray(phophong.managedTeamIds));
      console.log('type:', typeof phophong.managedTeamIds);
    },
    status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
  };
  
  await userController.getAllUsers(req, res);
  
  process.exit(0);
})();
