const { sequelize } = require('./src/models');
async function check() {
  const [results] = await sequelize.query(`
    SELECT id, username, fullName, role, roles, "teamId"
    FROM "Users"
    WHERE role IS NULL;
  `);
  console.log('Users with role = NULL:', results.length);
  if (results.length > 0) {
    console.log(results.slice(0, 5));
  }
}
check().catch(console.error).finally(() => process.exit(0));
