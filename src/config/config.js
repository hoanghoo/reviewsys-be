require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'iprs_user',
    password: process.env.DB_PASS || 'iprs_password',
    database: process.env.DB_NAME || 'iprs_db',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    logging: false
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
  }
};
