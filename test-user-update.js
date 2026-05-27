require('dotenv').config({ path: '.env.development' });
const { User, sequelize } = require('./src/models');
const userController = require('./src/controllers/userController');

(async () => {
  const users = await User.findAll({ where: { position: 'Phó phòng' } });
  if (!users.length) return console.log('No phó phòng');
  
  const u = users[0];
  console.log('Original managedTeamIds:', u.managedTeamIds);
  
  const req = {
    params: { id: u.id },
    body: {
      fullName: u.fullName,
      position: u.position,
      roles: u.roles,
      teamId: u.teamId,
      managedTeamIds: [2, 4] // try setting to this
    }
  };
  
  const res = {
    json: (data) => console.log('Response:', data),
    status: (code) => {
      console.log(`Status ${code}`);
      return { json: (data) => console.log(`Status ${code}:`, data) };
    }
  };
  
  await userController.updateUser(req, res);
  
  const updated = await User.findByPk(u.id);
  console.log('After API call:', updated.managedTeamIds);
  
  process.exit(0);
})();
