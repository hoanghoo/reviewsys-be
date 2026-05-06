'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('ReviewPeriods', 'templateId', {
      type: Sequelize.INTEGER,
      references: {
        model: 'Templates',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('ReviewPeriods', 'templateId');
  }
};
