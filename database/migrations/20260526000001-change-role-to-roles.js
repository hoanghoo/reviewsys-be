'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add new 'roles' JSON column
    await queryInterface.addColumn('Users', 'roles', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // 2. Migrate data from 'role' (ENUM/String) to 'roles' (JSON array)
    // Postgres specific: Update using raw query to cast string to json array
    try {
      await queryInterface.sequelize.query(`
        UPDATE "Users" 
        SET "roles" = json_build_array("role");
      `);
    } catch (err) {
      console.warn("Failed to use json_build_array, trying fallback for SQLite/other DBs...");
      const [users] = await queryInterface.sequelize.query('SELECT id, role FROM "Users";');
      for (const user of users) {
        if (user.role) {
          await queryInterface.sequelize.query(`
            UPDATE "Users" 
            SET "roles" = '${JSON.stringify([user.role])}' 
            WHERE id = ${user.id};
          `);
        }
      }
    }
    
    // We will not drop the 'role' column immediately just in case we need to rollback quickly,
    // but we can set its allow null to true if it isn't already, though ENUMs might have default values.
  },

  down: async (queryInterface, Sequelize) => {
    // In rollback, drop the 'roles' column
    await queryInterface.removeColumn('Users', 'roles');
  }
};
