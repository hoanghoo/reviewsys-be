'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add selfScore
    await queryInterface.addColumn('Reviews', 'selfScore', {
      type: Sequelize.FLOAT,
      allowNull: true
    });

    // 2. Add ManagerReviewed and Completed to enum "enum_Reviews_status"
    // Postgres specific raw query for adding to enum:
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Reviews_status" ADD VALUE 'ManagerReviewed';`);
    } catch (e) {
      console.log('ManagerReviewed might already exist or not supported on this dialect');
    }
    
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_Reviews_status" ADD VALUE 'Completed';`);
    } catch (e) {
      console.log('Completed might already exist or not supported on this dialect');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Reviews', 'selfScore');
    // Note: Postgres does not support removing values from an enum easily.
  }
};
