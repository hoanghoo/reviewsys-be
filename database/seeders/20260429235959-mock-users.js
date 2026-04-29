'use strict';
const bcrypt = require('bcryptjs');

function removeVietnameseTones(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function generateUsername(fullName) {
  const parts = fullName.split(' ');
  const name = removeVietnameseTones(parts.pop());
  const initials = parts.map(p => removeVietnameseTones(p)[0]).join('');
  return initials + name;
}

const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const middleNames = ['Văn', 'Thị', 'Hữu', 'Đức', 'Trọng', 'Minh', 'Thanh', 'Quang', 'Bá', 'Tiến', 'Hải', 'Xuân', 'Thu', 'Hoài', 'Ngọc', 'Gia'];
const lastNames = ['Anh', 'Bình', 'Cường', 'Dũng', 'Dương', 'Đạt', 'Hải', 'Hiếu', 'Hòa', 'Hùng', 'Huy', 'Khoa', 'Kiên', 'Lâm', 'Linh', 'Long', 'Minh', 'Nam', 'Nghĩa', 'Ngọc', 'Phong', 'Phúc', 'Quân', 'Quang', 'Sơn', 'Tài', 'Tâm', 'Thái', 'Thành', 'Thắng', 'Thịnh', 'Trang', 'Trí', 'Trung', 'Tuấn', 'Tùng', 'Vinh', 'Việt', 'Vũ', 'Phương', 'Lan', 'Mai', 'Chi'];

const teams = [
  { shortName: 'Đội 1', fullName: 'Tham mưu, Tổng hợp' },
  { shortName: 'Đội 2', fullName: 'PCTP sử dụng mạng máy tính' },
  { shortName: 'Đội 3', fullName: 'PCTP công nghệ cao xâm phạm TTXH' },
  { shortName: 'Đội 4', fullName: 'PCTP trong lĩnh vực TMĐT' },
  { shortName: 'Đội 5', fullName: 'Giám định pháp y kỹ thuật số' },
  { shortName: 'Đội 6', fullName: 'Trinh sát kỹ thuật' },
  { shortName: 'Ban Lãnh đạo', fullName: 'Ban Lãnh đạo Phòng' }
];

const ranks = ['Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá'];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [departments] = await queryInterface.sequelize.query(
      `SELECT id FROM Departments WHERE name='Phòng an ninh mạng và PCTP sử dụng công nghệ cao' LIMIT 1;`
    );
    const deptId = departments.length > 0 ? departments[0].id : null;

    if (!deptId) return;

    // Seed teams
    for (const t of teams) {
      await queryInterface.bulkInsert('Teams', [{
        shortName: t.shortName,
        fullName: t.fullName,
        createdAt: new Date(),
        updatedAt: new Date()
      }], { ignoreDuplicates: true });
    }

    const [dbTeams] = await queryInterface.sequelize.query(`SELECT id, shortName FROM Teams;`);
    const teamIdMap = {};
    dbTeams.forEach(t => teamIdMap[t.shortName] = t.id);

    // Use a default password of "123456" for all mock users
    const hashedPassword = bcrypt.hashSync('123456', 8);
    const users = [];
    const usedUsernames = new Set(['admin', 'man', 'user']);

    for (let i = 0; i < 97; i++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const mName = middleNames[Math.floor(Math.random() * middleNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${fName} ${mName} ${lName}`;
      
      let username = generateUsername(fullName);
      let suffix = 1;
      let origUser = username;
      while(usedUsernames.has(username)) {
        username = `${origUser}${suffix}`;
        suffix++;
      }
      usedUsernames.add(username);

      let selectedTeam = teams[Math.floor(Math.random() * (teams.length - 1))]; // Exclude Ban Lãnh đạo
      
      let position = 'Cán bộ';
      let role = 'Employee';
      let rank = ranks[Math.floor(Math.random() * 4)]; // Thiếu úy -> Đại úy

      const rand = Math.random();
      if (rand > 0.96) {
        position = 'Đội trưởng';
        role = 'Manager';
        rank = ranks[Math.floor(Math.random() * 2) + 4]; // Thiếu tá, Trung tá
      } else if (rand > 0.88) {
        position = 'Phó đội trưởng';
        role = 'Manager';
        rank = ranks[Math.floor(Math.random() * 2) + 3]; // Đại úy, Thiếu tá
      } else if (rand > 0.86) {
        position = 'Phó trưởng phòng';
        role = 'Manager';
        rank = 'Thượng tá';
        selectedTeam = teams.find(t => t.shortName === 'Ban Lãnh đạo');
      }

      users.push({
        username,
        password: hashedPassword,
        fullName,
        role,
        departmentId: deptId,
        rank,
        position,
        teamId: teamIdMap[selectedTeam.shortName],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    await queryInterface.bulkInsert('Users', users, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('Users', {
      username: {
        [Sequelize.Op.notIn]: ['admin', 'man', 'user']
      }
    }, {});
    await queryInterface.bulkDelete('Teams', null, {});
  }
};
