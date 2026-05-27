require('dotenv').config({ path: '.env.development' });
const { User, sequelize } = require('./src/models');
const teamController = require('./src/controllers/teamController');

(async () => {
  const users = await User.findAll({ where: { position: 'Phó phòng' } });
  if (!users.length) return console.log('No phó phòng');
  
  const u = users[0];
  console.log('Original managedTeamIds:', u.managedTeamIds);
  
  const req = {
    params: { id: u.teamId },
    body: {
      users: [{
        id: u.id,
        position: 'Phó phòng',
        roles: ['Manager'],
        managedTeamIds: [1, 5, 9] // try setting to this
      }]
    }
  };
  
  const res = {
    json: (data) => console.log('Response:', data),
    status: (code) => ({ json: (data) => console.log(`Status ${code}:`, data) })
  };
  
  await teamController.assignLeader(req, res);
  
  const updated = await User.findByPk(u.id);
  console.log('After API call:', updated.managedTeamIds);
  
  process.exit(0);
})();
