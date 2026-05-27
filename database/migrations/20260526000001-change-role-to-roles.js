'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add new 'roles' JSON column
    await queryInterface.addColumn('Users', 'roles', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    const dialect = queryInterface.sequelize.getDialect();
    const tableName = dialect === 'postgres' ? '"Users"' : '`Users`';
    const roleCol = dialect === 'postgres' ? '"role"' : '`role`';
    const rolesCol = dialect === 'postgres' ? '"roles"' : '`roles`';

    try {
      if (dialect === 'postgres') {
        await queryInterface.sequelize.query(`
          UPDATE ${tableName} 
          SET ${rolesCol} = json_build_array(${roleCol});
        `);
      } else if (dialect === 'mysql' || dialect === 'mariadb') {
        await queryInterface.sequelize.query(`
          UPDATE ${tableName} 
          SET ${rolesCol} = JSON_ARRAY(${roleCol});
        `);
      } else {
        throw new Error('Unsupported dialect for direct json array cast');
      }
    } catch (err) {
      console.warn("Failed to use JSON functions, trying fallback for SQLite/other DBs...");
      const [users] = await queryInterface.sequelize.query(`SELECT id, role FROM ${tableName};`);
      for (const user of users) {
        if (user.role) {
          await queryInterface.sequelize.query(`
            UPDATE ${tableName} 
            SET ${rolesCol} = '${JSON.stringify([user.role])}' 
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
