const { sequelize } = require('./src/models');
async function check() {
  const [results] = await sequelize.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Users';
  `);
  console.log(results);
}
check().catch(console.error).finally(() => process.exit(0));
