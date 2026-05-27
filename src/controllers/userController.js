const { User, Department, Team, sequelize } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');


const calculateRoles = (inputRoles, position, teamId, isLeadershipTeam, isTeam1) => {
  const rolesSet = new Set(Array.isArray(inputRoles) ? inputRoles : [inputRoles || "Employee"]);
  
  // Everyone should probably be at least Employee unless strictly only Admin
  if (rolesSet.size === 0) rolesSet.add("Employee");

  // 1. Nếu thuộc ban lãnh đạo => role: lãnh đạo
  if (isLeadershipTeam) {
    rolesSet.add("Leader");
  }

  // 2. Nếu là đội trưởng/đội phó => chỉ huy đội (Manager)
  if (position === 'Đội trưởng' || position === 'Đội phó') {
    rolesSet.add("Manager");
  }

  // 3. Nếu thuộc đội 1 => thêm role: quản trị viên vào role hiện có
  if (teamId === 1 || teamId === '1' || isTeam1) {
    rolesSet.add("Admin");
  }

  return Array.from(rolesSet);
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Team, attributes: ['id', 'shortName', 'fullName'] }
      ]
    });
    const usersJSON = users.map(u => {
      const json = u.toJSON();
      if (json.teamId === 1 || (u.Team && u.Team.shortName === 'Đội 1')) {
        if (!json.roles) json.roles = []; if (!json.roles.includes("Admin")) json.roles.push("Admin");
      } else if (json.teamId === 7 || (u.Team && u.Team.shortName === 'Ban Lãnh đạo')) {
        if (!json.roles) json.roles = []; if (!json.roles.includes("Leader")) json.roles.push("Leader");
      }
      return json;
    });
    res.status(200).json(usersJSON);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { username, password, fullName, role, departmentId, rank, position, teamId, managedTeamIds } = req.body;
    
    // Check if team is Ban Lãnh đạo
    let isLeadershipTeam = false;
    let isTeam1 = false;
    if (teamId) {
      const team = await Team.findByPk(teamId);
      if (team && (team.shortName === 'Ban Lãnh đạo' || team.id === 7)) {
        isLeadershipTeam = true;
      }
      if (team && (team.shortName === 'Đội 1' || team.id === 1)) {
        isTeam1 = true;
      }
    }

    if (isLeadershipTeam) {
      if (position === 'Đội trưởng' || position === 'Đội phó') {
        return res.status(400).json({ message: 'Ban Lãnh đạo không có chức vụ Đội trưởng hoặc Đội phó' });
      }
    }

    // Enforce 1 Trưởng phòng rule
    if (position === 'Trưởng phòng') {
      const existing = await User.findOne({ where: { position: 'Trưởng phòng' } });
      if (existing) {
        return res.status(400).json({ message: `Hệ thống đã có Trưởng phòng (${existing.fullName})` });
      }
    }

    // Enforce 1 Commander, 1 Deputy Rule for regular teams
    if (teamId && !isLeadershipTeam && (position === 'Đội trưởng' || position === 'Đội phó')) {
      const posCheck = (position === 'Đội phó')
        ? ['Đội phó']
        : [position];
      const existing = await User.findOne({
        where: {
          teamId,
          position: { [Op.in]: posCheck }
        }
      });
      if (existing) {
        return res.status(400).json({ message: `Đội này đã có ${position} (${existing.fullName})` });
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 8);
    const dbRoles = calculateRoles(req.body.roles, position, teamId, isLeadershipTeam, isTeam1);
    const user = await User.create({
      username, password: hashedPassword, fullName, roles: dbRoles, departmentId, rank, position, teamId, managedTeamIds
    });
    
    const userWithoutPassword = user.toJSON();

    delete userWithoutPassword.password;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  console.log("updateUser req.body:", JSON.stringify(req.body, null, 2));
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { fullName, role, departmentId, password, rank, position, teamId, managedTeamIds } = req.body;
    
    // Check if team is Ban Lãnh đạo
    let isLeadershipTeam = false;
    let isTeam1 = false;
    if (teamId) {
      const team = await Team.findByPk(teamId);
      if (team && (team.shortName === 'Ban Lãnh đạo' || team.id === 7)) {
        isLeadershipTeam = true;
      }
      if (team && (team.shortName === 'Đội 1' || team.id === 1)) {
        isTeam1 = true;
      }
    }

    if (isLeadershipTeam) {
      if (position === 'Đội trưởng' || position === 'Đội phó') {
        return res.status(400).json({ message: 'Ban Lãnh đạo không có chức vụ Đội trưởng hoặc Đội phó' });
      }
    }

    // Enforce 1 Trưởng phòng rule
    if (position === 'Trưởng phòng') {
      const existing = await User.findOne({
        where: {
          position: 'Trưởng phòng',
          id: { [Op.ne]: user.id }
        }
      });
      if (existing) {
        return res.status(400).json({ message: `Hệ thống đã có Trưởng phòng (${existing.fullName})` });
      }
    }

    // Enforce 1 Commander, 1 Deputy Rule for regular teams
    if (teamId && !isLeadershipTeam && (position === 'Đội trưởng' || position === 'Đội phó')) {
      const posCheck = (position === 'Đội phó')
        ? ['Đội phó']
        : [position];
      const existing = await User.findOne({ 
        where: { 
          teamId, 
          position: { [Op.in]: posCheck },
          id: { [Op.ne]: user.id } // Exclude current user
        } 
      });
      if (existing) {
        return res.status(400).json({ message: `Đội này đã có ${position} (${existing.fullName})` });
      }
    }

    const dbRoles = calculateRoles(req.body.roles, position, teamId, isLeadershipTeam);
    const updateData = { fullName, roles: dbRoles, departmentId, rank, position, teamId, managedTeamIds };
    if (password) {
      updateData.password = bcrypt.hashSync(password, 8);
    }

    await user.update(updateData);
    
    const userWithoutPassword = user.toJSON();
    if (userWithoutPassword.teamId === 1 || (teamId && isTeam1)) {
      if (!userWithoutPassword.roles) userWithoutPassword.roles = []; if (!userWithoutPassword.roles.includes("Admin")) userWithoutPassword.roles.push("Admin");
    } else if (userWithoutPassword.teamId === 7) {
      if (!userWithoutPassword.roles) userWithoutPassword.roles = []; if (!userWithoutPassword.roles.includes("Leader")) userWithoutPassword.roles.push("Leader");
    }
    delete userWithoutPassword.password;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await user.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Team, attributes: ['id', 'shortName', 'fullName'] }
      ]
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const userJSON = user.toJSON();
    if (user.teamId === 1) {
      if (!userJSON.roles) userJSON.roles = []; if (!userJSON.roles.includes("Admin")) userJSON.roles.push("Admin");
    } else if (user.teamId === 7 || (user.Team && user.Team.shortName === 'Ban Lãnh đạo')) {
      if (!userJSON.roles) userJSON.roles = []; if (!userJSON.roles.includes("Leader")) userJSON.roles.push("Leader");
    }
    
    if (user.teamId) {
      // Prioritize Đội trưởng over Đội phó
      let manager = await User.findOne({
        where: { teamId: user.teamId, position: 'Đội trưởng' },
        attributes: ['fullName']
      });

      if (!manager) {
        manager = await User.findOne({
          where: { teamId: user.teamId, position: 'Đội phó' },
          attributes: ['fullName']
        });
      }

      // Fallback to any Manager if no specific position found
      if (!manager) {
        manager = await User.findOne({
          where: { teamId: user.teamId, role: 'Manager' },
          attributes: ['fullName']
        });
      }

      if (manager) {
        userJSON.managerName = manager.fullName;
      }
    }
    
    res.status(200).json(userJSON);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = bcrypt.compareSync(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác' });
    }

    user.password = bcrypt.hashSync(newPassword, 8);
    await user.save();

    res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTeamUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const currentUser = await User.findByPk(req.user.id);

    let where = {};
    if (currentUser.roles && currentUser.roles.includes("Manager")) {
      where.teamId = currentUser.teamId;
    }

    if (search) {
      where.fullName = { [Op.substring]: search };
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [
        { model: Team, attributes: ['id', 'shortName', 'fullName'] }
      ]
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');

const fileFilterExcel = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    cb(null, true);
  } else {
    cb(new Error('Chỉ hỗ trợ file Excel (.xlsx, .xls)'), false);
  }
};

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilterExcel
});

const removeVietnameseTones = (str) => {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
};

const generateUsername = (fullName) => {
  const parts = fullName.trim().split(/\s+/);
  const name = removeVietnameseTones(parts.pop());
  const initials = parts.map(p => removeVietnameseTones(p)[0]).join('');
  return initials + name;
};

const VALID_RANKS = [
  'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá',
  'Đại úy', 'Thượng úy', 'Trung úy', 'Thiếu úy',
  'Thượng sĩ', 'Trung sĩ', 'Hạ sĩ',
  'Binh nhất', 'Binh nhì'
];

const VALID_POSITIONS = [
  'Trưởng phòng',
  'Phó phòng',
  'Đội trưởng',
  'Đội phó',
  'Cán bộ'
];

const importTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách cán bộ');
    
    // Headers
    worksheet.columns = [
      { header: 'Họ và tên', key: 'fullName', width: 25 },
      { header: 'Cấp bậc', key: 'rank', width: 18 },
      { header: 'Chức vụ', key: 'position', width: 18 },
      { header: 'Đội', key: 'team', width: 22 }
    ];
    
    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4F46E5' } // Premium Indigo color
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'D1D5DB' } },
        left: { style: 'thin', color: { argb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
        right: { style: 'thin', color: { argb: 'D1D5DB' } }
      };
    });
    
    // Add sample rows
    const sampleData = [
      { fullName: 'Nguyễn Văn Hùng', rank: 'Đại úy', position: 'Đội trưởng', team: 'Đội 1' },
      { fullName: 'Trần Thị Lan', rank: 'Thượng úy', position: 'Cán bộ', team: 'Đội 2' },
      { fullName: 'Lê Hồng Minh', rank: 'Thượng tá', position: 'Trưởng phòng', team: 'Ban Lãnh đạo' }
    ];
    
    sampleData.forEach(item => {
      const row = worksheet.addRow(item);
      row.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 11 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } }
        };
      });
    });

    // Instructions sheet
    const guideSheet = workbook.addWorksheet('Hướng dẫn nhập');
    guideSheet.columns = [
      { header: 'Thông tin', width: 20 },
      { header: 'Giá trị / Ràng buộc', width: 70 }
    ];
    
    const gHeader = guideSheet.getRow(1);
    gHeader.height = 24;
    gHeader.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const teams = await Team.findAll({ attributes: ['shortName'] });
    const teamNames = ['Ban Lãnh đạo', ...teams.map(t => t.shortName)];

    guideSheet.addRow(['Cấp bậc', VALID_RANKS.join(', ')]);
    guideSheet.addRow(['Chức vụ', VALID_POSITIONS.join(', ')]);
    guideSheet.addRow(['Đội', teamNames.join(', ')]);
    guideSheet.addRow(['Ràng buộc Chức vụ', 'Trưởng phòng và Phó phòng bắt buộc thuộc Ban Lãnh đạo. Đội trưởng, Đội phó và Cán bộ KHÔNG thuộc Ban Lãnh đạo.']);
    
    guideSheet.eachRow((row, rNum) => {
      if (rNum === 1) return;
      row.eachCell((c) => {
        c.font = { name: 'Times New Roman', size: 11 };
        c.alignment = { vertical: 'middle', wrapText: true };
        c.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } }
        };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Template_Import_Nhan_Su.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const importPreview = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên file Excel' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ message: 'File Excel rỗng hoặc không đúng cấu trúc' });
    }

    const teams = await Team.findAll();
    const teamMap = {};
    teams.forEach(t => {
      teamMap[t.shortName.toLowerCase().trim()] = t;
      teamMap[t.fullName.toLowerCase().trim()] = t;
    });

    const parsedUsers = [];
    const usedUsernames = new Set();

    const existingUsers = await User.findAll({ attributes: ['username'] });
    const existingUsernames = new Set(existingUsers.map(u => u.username.toLowerCase()));

    const getCellValue = (cell) => {
      if (!cell) return '';
      if (cell.value && typeof cell.value === 'object') {
        if (cell.value.richText) {
          return cell.value.richText.map(rt => rt.text).join('').trim();
        }
        return cell.value.toString().trim();
      }
      return cell.value?.toString().trim() || '';
    };

    let rowNum = 1;
    worksheet.eachRow({ includeEmpty: false }, (row, index) => {
      if (index === 1) return; // skip header
      
      const fullName = getCellValue(row.getCell(1));
      const rank = getCellValue(row.getCell(2));
      const position = getCellValue(row.getCell(3));
      const teamName = getCellValue(row.getCell(4));

      if (!fullName && !rank && !position && !teamName) return; // skip empty rows

      const errors = [];
      let warning = '';
      
      if (!fullName) errors.push('Họ và tên không được để trống');
      if (!rank) errors.push('Cấp bậc không được để trống');
      if (!position) errors.push('Chức vụ không được để trống');
      if (!teamName) errors.push('Đội không được để trống');

      let matchedRank = '';
      if (rank) {
        matchedRank = VALID_RANKS.find(r => r.toLowerCase().trim() === rank.toLowerCase().trim());
        if (!matchedRank) {
          errors.push(`Cấp bậc '${rank}' không hợp lệ`);
        }
      }

      let matchedPosition = '';
      if (position) {
        matchedPosition = VALID_POSITIONS.find(p => p.toLowerCase().trim() === position.toLowerCase().trim());
        if (!matchedPosition) {
          errors.push(`Chức vụ '${position}' không hợp lệ`);
        }
      }

      let matchedTeam = null;
      if (teamName) {
        const normalizedTeamName = teamName.toLowerCase().trim();
        if (normalizedTeamName === 'ban lãnh đạo' || normalizedTeamName === 'ban lanh dao') {
          matchedTeam = teams.find(t => t.shortName === 'Ban Lãnh đạo' || t.id === 7);
        } else {
          matchedTeam = teamMap[normalizedTeamName];
        }
        if (!matchedTeam) {
          errors.push(`Đội '${teamName}' không tồn tại trong hệ thống`);
        }
      }

      if (matchedPosition && matchedTeam) {
        const isLeadershipTeam = matchedTeam.shortName === 'Ban Lãnh đạo' || matchedTeam.id === 7;
        if (isLeadershipTeam) {
          if (matchedPosition !== 'Trưởng phòng' && matchedPosition !== 'Phó phòng') {
            errors.push('Ban Lãnh đạo chỉ hỗ trợ chức vụ Trưởng phòng hoặc Phó phòng');
          }
        } else {
          if (matchedPosition === 'Trưởng phòng' || matchedPosition === 'Phó phòng') {
            errors.push(`Đội '${matchedTeam.shortName}' không thể có chức vụ ${matchedPosition}`);
          }
        }
      }

      let username = '';
      let password = '';
      if (fullName) {
        username = generateUsername(fullName);
        let suffix = 1;
        let originalUsername = username;
        while (usedUsernames.has(username)) {
          username = `${originalUsername}${suffix}`;
          suffix++;
        }
        usedUsernames.add(username);

        if (existingUsernames.has(username.toLowerCase())) {
          warning = `Trùng LDAP: Tài khoản '${username}' đã tồn tại. Sẽ tự động thêm hậu số khi tạo mới tài khoản.`;
        }

        password = Math.random().toString(36).substring(2, 10);
      }

      parsedUsers.push({
        id: rowNum++,
        fullName,
        rank: matchedRank || rank,
        position: matchedPosition || position,
        teamName: matchedTeam ? matchedTeam.shortName : teamName,
        teamId: matchedTeam ? matchedTeam.id : null,
        username,
        password,
        isValid: errors.length === 0,
        errors,
        warning
      });
    });

    res.json(parsedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const importSubmit = async (req, res) => {
  try {
    const { users } = req.body;
    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    const savedUsers = [];
    const departments = await Department.findAll();
    const deptId = departments.length > 0 ? departments[0].id : null;

    const dbUsers = await User.findAll({ attributes: ['username'] });
    const dbUsernames = new Set(dbUsers.map(u => u.username.toLowerCase()));

    for (const u of users) {
      if (!u.isValid) continue;

      let finalUsername = u.username;
      let suffix = 1;
      let originalUsername = finalUsername;

      while (dbUsernames.has(finalUsername.toLowerCase())) {
        finalUsername = `${originalUsername}${suffix}`;
        suffix++;
      }
      dbUsernames.add(finalUsername.toLowerCase());

      const hashedPassword = bcrypt.hashSync(u.password, 8);

      let roles = calculateRoles(["Employee"], u.position, u.teamId, u.teamName === 'Ban Lãnh đạo', u.teamName === 'Đội 1');

      const newUser = await User.create({
        username: finalUsername,
        password: hashedPassword,
        fullName: u.fullName,
        roles: roles, // Map Leader to Employee in DB
        departmentId: deptId,
        rank: u.rank,
        position: u.position,
        teamId: u.teamId,
        managedTeamIds: []
      });

      savedUsers.push({
        fullName: newUser.fullName,
        rank: newUser.rank,
        position: newUser.position,
        teamName: u.teamName,
        username: newUser.username,
        password: u.password
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cán bộ đã tạo');

    worksheet.columns = [
      { header: 'Họ và tên', key: 'fullName', width: 25 },
      { header: 'Cấp bậc', key: 'rank', width: 18 },
      { header: 'Chức vụ', key: 'position', width: 18 },
      { header: 'Đội', key: 'teamName', width: 22 },
      { header: 'Tài khoản (Username)', key: 'username', width: 25 },
      { header: 'Mật khẩu (Password)', key: 'password', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '10B981' } // Emerald green
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'D1D5DB' } },
        left: { style: 'thin', color: { argb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
        right: { style: 'thin', color: { argb: 'D1D5DB' } }
      };
    });

    savedUsers.forEach(item => {
      const row = worksheet.addRow(item);
      row.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 11 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } }
        };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Tai_khoan_nhan_su_da_tao.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  changePassword,
  getTeamUsers,
  uploadMemory,
  importTemplate,
  importPreview,
  importSubmit
};
