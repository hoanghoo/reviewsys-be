const { User } = require('./src/models');
const { Op } = require('sequelize');

console.log(User.rawAttributes.role);
