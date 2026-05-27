const { User, Team } = require('./src/models');

async function run() {
  const users = await User.findAll({
    order: [['fullName', 'ASC']]
  });
  console.log(`Total users: ${users.length}`);
  
  const names = users.map(u => u.fullName);
  console.log('User 1:', names[0]);
  console.log('User 2:', names[1]);
  console.log('User 3:', names[2]);
  console.log('User 4:', names[3]);
  console.log('User 5:', names[4]);
}
run().catch(console.error);
