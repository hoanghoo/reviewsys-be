'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Templates', 'fileData', {
      type: Sequelize.TEXT('long'),
      allowNull: true
    });
    // Optional: We can drop filePath later, or keep it for legacy if needed, but since we are refactoring:
    // await queryInterface.removeColumn('Templates', 'filePath');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Templates', 'fileData');
  }
};
