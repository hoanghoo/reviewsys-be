const { Sequelize } = require('sequelize');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';

const sequelize = isTest
  ? new Sequelize('sqlite::memory:', { logging: false })
  : new Sequelize(
      process.env.DB_NAME || 'iprs_db',
      process.env.DB_USER || 'iprs_user',
      process.env.DB_PASS || 'iprs_password',
      {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: false,
      }
    );

module.exports = sequelize;
