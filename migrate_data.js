require('dotenv').config({ path: '.env.postgres' }); // Load Postgres credentials
const { Sequelize } = require('sequelize');

// Setup Postgres Connection
const pgSeq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

// Setup MySQL Connection
require('dotenv').config({ path: '.env.development', override: true }); // Override with MySQL
const mySeq = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
  }
);

async function migrateTable(tableName, pgDb, myDb) {
  console.log(`Migrating table: ${tableName}...`);
  try {
    const [rows] = await pgDb.query(`SELECT * FROM "${tableName}";`);
    console.log(`Found ${rows.length} records in ${tableName}.`);
    
    if (rows.length === 0) return;

    // Stringify objects/arrays for JSON columns
    const cleanRows = rows.map(row => {
      const newRow = { ...row };
      for (const key in newRow) {
        if (typeof newRow[key] === 'object' && newRow[key] !== null && !(newRow[key] instanceof Date)) {
          newRow[key] = JSON.stringify(newRow[key]);
        }
      }
      return newRow;
    });

    // We can use bulkInsert on myDb
    await myDb.getQueryInterface().bulkInsert(tableName, cleanRows);
    console.log(`Successfully inserted ${rows.length} records into ${tableName}.`);
  } catch (error) {
    console.error(`Error migrating table ${tableName}:`, error.message);
  }
}

async function run() {
  try {
    await pgSeq.authenticate();
    console.log('Connected to PostgreSQL.');
    await mySeq.authenticate();
    console.log('Connected to MySQL.');

    // Disable FK checks on MySQL
    await mySeq.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Truncate tables in MySQL first (to avoid duplicates if re-running)
    const tables = ['Departments', 'Teams', 'Users', 'Templates', 'ReviewPeriods', 'Reviews'];
    for (const table of tables) {
      await mySeq.query(`TRUNCATE TABLE \`${table}\`;`);
    }

    for (const table of tables) {
      await migrateTable(table, pgSeq, mySeq);
    }

    // Re-enable FK checks
    await mySeq.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Data migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pgSeq.close();
    await mySeq.close();
  }
}

run();
