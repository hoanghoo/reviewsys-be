'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create a dummy department (if not exists, bulkInsert with duplicate key update is tricky across dialects, so we just try to insert, or we can use raw query)
    try {
      await queryInterface.bulkInsert('Departments', [{
        name: 'Phòng an ninh mạng và PCTP sử dụng công nghệ cao',
        description: 'Phòng ban mặc định',
        createdAt: new Date(),
        updatedAt: new Date()
      }]);
    } catch (e) {
      // Ignore if it already exists
    }

    // Retrieve the department ID
    const [departments] = await queryInterface.sequelize.query(
      `SELECT id FROM "Departments" WHERE name='Phòng an ninh mạng và PCTP sử dụng công nghệ cao' LIMIT 1;`
    );
    const deptId = departments.length > 0 ? departments[0].id : null;

    // Delete existing test users to prevent duplicate errors
    await queryInterface.bulkDelete('Users', { username: ['admin', 'man', 'user'] }, {});

    // 2. Hash passwords
    const hashedPasswordAdmin = bcrypt.hashSync('admin', 8);
    const hashedPasswordMan = bcrypt.hashSync('man', 8);
    const hashedPasswordUser = bcrypt.hashSync('user', 8);

    // 3. Insert users
    await queryInterface.bulkInsert('Users', [
      {
        username: 'admin',
        password: hashedPasswordAdmin,
        fullName: 'System Admin',
        role: 'Admin',
        departmentId: deptId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'man',
        password: hashedPasswordMan,
        fullName: 'IT Manager',
        role: 'Manager',
        departmentId: deptId,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        username: 'user',
        password: hashedPasswordUser,
        fullName: 'Normal User',
        role: 'Employee',
        departmentId: deptId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', { username: ['admin', 'man', 'user'] }, {});
    await queryInterface.bulkDelete('Departments', { name: 'Phòng an ninh mạng và PCTP sử dụng công nghệ cao' }, {});
  }
};
