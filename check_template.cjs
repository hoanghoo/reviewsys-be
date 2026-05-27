const { sequelize } = require('./src/models');
async function check() {
  const [results] = await sequelize.query(`SELECT html FROM "Templates" LIMIT 1;`);
  console.log(results[0].html.substring(0, 1000));
}
check().catch(console.error).finally(() => process.exit(0));
