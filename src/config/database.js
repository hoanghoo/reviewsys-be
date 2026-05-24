const { Sequelize } = require('sequelize');
const path = require('path');
const dotenv = require('dotenv');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, '../../', envFile) });
dotenv.config(); // fallback

const isTest = process.env.NODE_ENV === 'test';

const sequelize = (() => {
  if (isTest) {
    return new Sequelize('sqlite::memory:', { logging: false });
  }

  if (process.env.DATABASE_URL) {
    try {
      const { URL } = require('url');
      const dbUrl = new URL(process.env.DATABASE_URL);

      console.log(dbUrl.hostname, dbUrl.port);

      return new Sequelize(dbUrl.pathname.substring(1), dbUrl.username, dbUrl.password, {
        host: dbUrl.hostname,
        port: dbUrl.port || 5432,
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      });
    } catch (err) {
      console.error('Failed to parse DATABASE_URL with URL class, falling back to direct string:', err.message);
      // Fallback for simple strings or if URL parsing fails
      return new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
      });
    }
  }

  // Fallback for local development using individual DB_ variables
  return new Sequelize(
    process.env.DB_NAME || 'postgres',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || '123456',
    {
      host: process.env.DB_HOST || '127.0.0.1',
      dialect: 'postgres', // Based on your .env.development it's postgres
      logging: false,
    }
  );
})();

module.exports = sequelize;
