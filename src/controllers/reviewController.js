const { Review, ReviewPeriod, User, Department, Team, Template, sequelize } = require('../models');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const submitPersonalReview = async (req, res) => {
  try {
    const { reviewPeriodId, templateId, feedback, score } = req.body;
    const userId = req.user.id; // From verifyToken middleware

    // Check if the review period is open
    const period = await ReviewPeriod.findByPk(reviewPeriodId);
    if (!period || period.status !== 'Open') {
      return res.status(400).json({ message: 'Kỳ đánh giá này không khả dụng hoặc đã đóng' });
    }

    // Check if already submitted
    const existingReview = await Review.findOne({
      where: { reviewPeriodId, reviewerId: userId, revieweeId: userId }
    });

    if (existingReview) {
      // Update existing
      await existingReview.update({
        templateId,
        feedback: JSON.stringify(feedback),
        score,
        selfScore: score,
        status: 'Submitted'
      });
      return res.status(200).json(existingReview);
    } else {
      // Create new
      const review = await Review.create({
        reviewPeriodId,
        reviewerId: userId,
        revieweeId: userId,
        templateId,
        feedback: JSON.stringify(feedback),
        score,
        selfScore: score,
        status: 'Submitted'
      });
      return res.status(201).json(review);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTeamReviews = async (req, res) => {
  try {
    const { periodId, departmentId, teamId, status, search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const manager = await User.findByPk(req.user.id);
    const period = await ReviewPeriod.findByPk(periodId);
    if (!period) {
      return res.status(400).json({ message: 'Không tìm thấy kỳ đánh giá' });
    }

    if (!manager || (!manager.roles.includes("Manager") && !manager.roles.includes("Admin"))) {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    const { Op } = require('sequelize');
    let userWhere = { 
      role: { [Op.in]: ['Employee', 'Manager', 'Admin'] } // Include all roles for testing/tracking
    };

    // If period is scoped to multiple teams
    if (Array.isArray(period.teamIds) && period.teamIds.length > 0) {
      userWhere.teamId = { [Op.in]: period.teamIds };
    }

    // Filter by Search Name
    if (search) {
      userWhere.fullName = { [Op.substring]: search };
    }

    // Filter by Team/Dept
    if (manager.roles.includes("Manager")) {
      if (manager.position === 'Trưởng phòng') {
        if (teamId && teamId !== 'all') {
          userWhere.teamId = teamId;
        }
      } else if (manager.position === 'Phó trưởng phòng' || manager.position === 'Phó phòng') {
        const managed = Array.isArray(manager.managedTeamIds) ? manager.managedTeamIds : [];
        if (teamId && teamId !== 'all') {
          if (managed.includes(Number(teamId))) {
            userWhere.teamId = teamId;
          } else {
            return res.status(403).json({ message: 'Không có quyền quản lý đội này' });
          }
        } else {
          userWhere.teamId = { [Op.in]: managed };
        }
      } else {
        if (manager.teamId) {
          userWhere.teamId = manager.teamId;
        } else {
          userWhere.departmentId = manager.departmentId;
        }
      }
    } else {
      if (teamId && teamId !== 'all') {
        userWhere.teamId = teamId;
      } else if (departmentId && departmentId !== 'all') {
        userWhere.departmentId = departmentId;
      }
    }

    let reviewWhere = { reviewPeriodId: periodId };
    if (status) {
      reviewWhere.status = status;
    }

    console.log('Fetching team reviews with params:', { periodId, departmentId, status, page, limit });

    const { count, rows: users } = await User.findAndCountAll({
      where: userWhere,
      include: [
        {
          model: Review,
          as: 'ReviewsReceived',
          where: reviewWhere,
          required: status ? true : false,
          include: [{ model: User, as: 'Reviewer', attributes: ['id', 'fullName'] }]
        },
        {
          model: Team,
          attributes: ['id', 'shortName', 'fullName']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
      order: [['fullName', 'ASC']],
      logging: console.log // Log the SQL to debug
    });

    // Calculate stats for the entire team (not just paginated)
    const allUsers = await User.findAll({
      where: userWhere,
      attributes: ['id'],
      include: [{
        model: Review,
        as: 'ReviewsReceived',
        where: { reviewPeriodId: periodId },
        required: false
      }]
    });

    const stats = {
      total: allUsers.length,
      notStarted: 0,
      submitted: 0,
      managerReviewed: 0,
      completed: 0
    };

    allUsers.forEach(u => {
      const review = u.ReviewsReceived?.[0];
      console.log(`User ${u.id} review status:`, review ? review.status : 'No review');
      if (!review || review.status === 'Draft') stats.notStarted++;
      else if (review.status === 'Submitted') stats.submitted++;
      else if (review.status === 'ManagerReviewed') stats.managerReviewed++;
      else if (review.status === 'Reviewed' || review.status === 'Completed') stats.completed++;
    });
    console.log('Stats calculated:', stats);

    res.status(200).json({
      data: users,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      },
      stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, score, feedback } = req.body;

    const review = await Review.findByPk(id);
    if (!review) return res.status(404).json({ message: 'Không tìm thấy bản đánh giá' });

    // Only manager of the same department or admin can approve
    const manager = await User.findByPk(req.user.id);
    const reviewee = await User.findByPk(review.revieweeId);

    if (!manager.roles.includes("Admin") && manager.departmentId !== reviewee.departmentId) {
      return res.status(403).json({ message: 'Không có quyền duyệt bản đánh giá này' });
    }

    await review.update({
      status: status || 'ManagerReviewed', // Default to next step
      score: score !== undefined ? score : review.score,
      feedback: feedback ? (typeof feedback === 'string' ? feedback : JSON.stringify(feedback)) : review.feedback
    });

    res.status(200).json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportTeamExcel = async (req, res) => {
  try {
    const { year, teamId } = req.query;

    const manager = await User.findByPk(req.user.id, {
      include: [{ model: Team }]
    });

    const templatePath = path.join(__dirname, '../../template/overrall.xlsx');
    if (!require('fs').existsSync(templatePath)) {
      return res.status(404).json({ message: 'File template không tồn tại' });
    }

    let userWhere = {};
    if (manager.roles.includes("Manager")) {
      if (manager.position === 'Trưởng phòng') {
        if (teamId && teamId !== 'all') {
          userWhere.teamId = teamId;
        }
      } else if (manager.position === 'Phó trưởng phòng' || manager.position === 'Phó phòng') {
        const managed = Array.isArray(manager.managedTeamIds) ? manager.managedTeamIds : [];
        if (teamId && teamId !== 'all') {
          if (managed.includes(Number(teamId))) {
            userWhere.teamId = teamId;
          } else {
            return res.status(403).json({ message: 'Không có quyền xuất dữ liệu đội này' });
          }
        } else {
          userWhere.teamId = { [Op.in]: managed };
        }
      } else {
        if (manager.teamId) {
          userWhere.teamId = manager.teamId;
        } else {
          userWhere.departmentId = manager.departmentId;
        }
      }
    } else if (manager.roles.includes("Admin")) {
      if (teamId && teamId !== 'all') {
        userWhere.teamId = teamId;
      }
    }

    const members = await User.findAll({
      where: userWhere,
      order: [['fullName', 'ASC']]
    });

    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const { Op } = require('sequelize');
    const allPeriods = await ReviewPeriod.findAll({
      where: {
        endDate: {
          [Op.gte]: new Date(`${targetYear}-01-01`),
          [Op.lte]: new Date(`${targetYear}-12-31 23:59:59`)
        }
      }
    });

    const allReviews = await Review.findAll({
      where: {
        reviewPeriodId: { [Op.in]: allPeriods.map(p => p.id) },
        revieweeId: { [Op.in]: members.map(m => m.id) }
      }
    });

    const reviewsMap = {};
    allReviews.forEach(r => {
      if (!reviewsMap[r.revieweeId]) reviewsMap[r.revieweeId] = {};
      const p = allPeriods.find(periodObj => periodObj.id === r.reviewPeriodId);
      if (p) {
        const m = new Date(p.endDate).getMonth() + 1;
        reviewsMap[r.revieweeId][m] = r;
      }
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // Calculate team name and leader name (always the Đội trưởng's name of that team)
    let targetTeamId = teamId;
    if (!targetTeamId || targetTeamId === 'all') {
      targetTeamId = manager.teamId;
    }

    let teamObj = null;
    if (targetTeamId) {
      teamObj = await Team.findByPk(targetTeamId);
    }
    const teamName = teamObj ? teamObj.fullName.toUpperCase() : (manager.Team ? manager.Team.fullName.toUpperCase() : manager.username.toUpperCase());

    let leaderName = manager.fullName;
    if (targetTeamId) {
      const teamLeader = await User.findOne({
        where: { teamId: targetTeamId, position: 'Đội trưởng' }
      });
      if (teamLeader) {
        leaderName = teamLeader.fullName;
      }
    }

    for (let month = 1; month <= 12; month++) {
      const sheetName = `KPI_Thang${month}`;
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) continue;

      worksheet.getCell('A2').value = `ĐỘI: ${teamName}`;
      worksheet.getCell('D2').value = `THỰC HIỆN NHIỆM VỤ CỦA CBCS THÁNG ${month} NĂM ${targetYear}`;

      const templateRow = worksheet.getRow(6);
      const styles = [];
      templateRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styles[colNumber] = {
          style: Object.assign({}, cell.style || {}),
          border: Object.assign({}, cell.border || {}),
          font: Object.assign({}, cell.font || {}),
          alignment: Object.assign({}, cell.alignment || {})
        };
      });

      let sigRow = null;
      worksheet.eachRow((row, rNum) => {
        row.eachCell((c) => {
          if (c.value && typeof c.value === 'string' && c.value.toUpperCase().includes('TRƯỞNG')) {
            if (!sigRow) sigRow = rNum;
          }
        });
      });
      const dataRowCount = sigRow ? sigRow - 7 : 5;
      
      const rowsToInsert = members.length > dataRowCount ? members.length - dataRowCount : 0;
      const shiftRows = rowsToInsert;
      
      let mergesToShift = [];
      if (shiftRows > 0) {
        const oldMerges = Object.values(worksheet._merges || {}).map(m => m.model);
        oldMerges.forEach(m => {
            if (m.top > 6 + dataRowCount - 1) {
              worksheet.unMergeCells(m.top, m.left, m.bottom, m.right);
              mergesToShift.push(m);
            }
        });
        
        for(let i=0; i<shiftRows; i++) {
           worksheet.insertRow(6 + dataRowCount + i, []);
        }
      }

      members.forEach((member, index) => {
        const rowIndex = 6 + index;
        const row = worksheet.getRow(rowIndex);
        row.height = 19;
        
        if (index >= dataRowCount) {
           styles.forEach((styleObj, colNumber) => {
             if (!styleObj) return;
             const cell = row.getCell(colNumber);
             cell.style = Object.assign({}, styleObj.style);
             cell.border = Object.assign({}, styleObj.border);
             cell.font = Object.assign({}, styleObj.font);
             cell.alignment = Object.assign({}, styleObj.alignment);
           });
        }

        row.getCell(1).value = index + 1;
        row.getCell(2).value = member.fullName;
        
        const review = reviewsMap[member.id] ? reviewsMap[member.id][month] : null;
        if (review && (review.score !== null || review.selfScore !== null)) {
          const finalScore = Number(review.score !== null ? review.score : review.selfScore) || 0;
          row.getCell(3).value = finalScore;
          row.getCell(4).value = finalScore;
          row.getCell(6).value = 0;
          row.getCell(7).value = 0;

          row.getCell(5).value = { formula: `AVERAGE(C${rowIndex}:D${rowIndex})` };
          row.getCell(8).value = { formula: `ROUND(E${rowIndex}+F${rowIndex}-G${rowIndex},2)` };
          row.getCell(9).value = { formula: `IF(H${rowIndex}>90,"Hoàn thành xuất sắc",IF(H${rowIndex}>=75,"Hoàn thành tốt",IF(H${rowIndex}>=60,"Hoàn thành","Không hoàn thành")))` };
        } else {
          row.getCell(3).value = null;
          row.getCell(4).value = null;
          row.getCell(5).value = null;
          row.getCell(6).value = null;
          row.getCell(7).value = null;
          row.getCell(8).value = null;
          row.getCell(9).value = null;
        }
      });
      
      if (members.length < dataRowCount) {
         for(let i = members.length; i < dataRowCount; i++) {
            const row = worksheet.getRow(6 + i);
            row.hidden = true;
            row.eachCell((c) => {
               c.value = null;
               c.formula = null;
               c.sharedFormula = null;
            });
         }
      }

      mergesToShift.forEach(m => {
          worksheet.mergeCells(m.top + shiftRows, m.left, m.bottom + shiftRows, m.right);
      });

      let foundRow = null;
      let foundCol = 7;
      let mergeRight = 7;
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if(cell.value && typeof cell.value === 'string' && cell.value.toUpperCase().includes('TRƯỞNG')) {
            if (!foundRow) {
              foundRow = rowNumber;
              foundCol = colNumber;
              mergeRight = colNumber;
              
              Object.values(worksheet._merges || {}).forEach(m => {
                if (m.model.top <= rowNumber && m.model.bottom >= rowNumber && m.model.left <= colNumber && m.model.right >= colNumber) {
                  mergeRight = m.model.right;
                }
              });
            }
          }
        });
      });

      if (foundRow) {
        const foundColChar = String.fromCharCode(64 + foundCol);
        worksheet.getCell(foundColChar + (foundRow + 4)).value = leaderName;
        worksheet.getCell(foundColChar + (foundRow + 4)).font = { name: 'Times New Roman', size: 12, bold: true };
        worksheet.getCell(foundColChar + (foundRow + 4)).alignment = { horizontal: 'center' };
        
        if (mergeRight > foundCol) {
          const rightColChar = String.fromCharCode(64 + mergeRight);
          try {
            worksheet.mergeCells(`${foundColChar}${foundRow+4}:${rightColChar}${foundRow+4}`);
          } catch(e) {}
        }
      }
    }

    // --- Process "năm" sheet ---
    const namSheet = workbook.getWorksheet('năm');
    if (namSheet) {
      namSheet.getCell('A2').value = `ĐỘI: ${teamName}`;
      namSheet.getCell('D2').value = `THỰC HIỆN NHIỆM VỤ CỦA CBCS NĂM ${targetYear}`;

      const templateRow = namSheet.getRow(6);
      const styles = [];
      templateRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        styles[colNumber] = {
          style: Object.assign({}, cell.style || {}),
          border: Object.assign({}, cell.border || {}),
          font: Object.assign({}, cell.font || {}),
          alignment: Object.assign({}, cell.alignment || {})
        };
      });

      let sigRow = null;
      namSheet.eachRow((row, rNum) => {
        row.eachCell((c) => {
          if (c.value && typeof c.value === 'string' && c.value.toUpperCase().includes('TRƯỞNG')) {
            if (!sigRow) sigRow = rNum;
          }
        });
      });
      const dataRowCount = sigRow ? sigRow - 7 : 5;
      
      const rowsToInsert = members.length > dataRowCount ? members.length - dataRowCount : 0;
      const shiftRows = rowsToInsert;

      let mergesToShift = [];
      if (shiftRows > 0) {
        const oldMerges = Object.values(namSheet._merges || {}).map(m => m.model);
        oldMerges.forEach(m => {
            if (m.top > 6 + dataRowCount - 1) {
              namSheet.unMergeCells(m.top, m.left, m.bottom, m.right);
              mergesToShift.push(m);
            }
        });
        
        for(let i=0; i<shiftRows; i++) {
           namSheet.insertRow(6 + dataRowCount + i, []);
        }
      }

      members.forEach((member, index) => {
        const rowIndex = 6 + index;
        const row = namSheet.getRow(rowIndex);
        row.height = 19;
        
        if (index >= dataRowCount) {
           styles.forEach((styleObj, colNumber) => {
             if (!styleObj) return;
             const cell = row.getCell(colNumber);
             cell.style = Object.assign({}, styleObj.style);
             cell.border = Object.assign({}, styleObj.border);
             cell.font = Object.assign({}, styleObj.font);
             cell.alignment = Object.assign({}, styleObj.alignment);
           });
        }

        row.getCell(1).value = index + 1;
        row.getCell(2).value = member.fullName;
        
        for(let m = 1; m <= 12; m++) {
          row.getCell(2 + m).value = { formula: `INDEX(KPI_Thang${m}!$H:$H, ROW(A${rowIndex}))` };
        }
        
        row.getCell(15).value = { formula: `ROUND(AVERAGE(C${rowIndex}:N${rowIndex}),2)` };
        row.getCell(16).value = { formula: `IF(O${rowIndex}>90,"Xuất sắc",IF(O${rowIndex}>=75,"Tốt",IF(O${rowIndex}>=60,"Hoàn Thành","Không Hoàn Thành")))` };
      });
      
      if (members.length < dataRowCount) {
         for(let i = members.length; i < dataRowCount; i++) {
            const row = namSheet.getRow(6 + i);
            row.hidden = true;
            row.eachCell((c) => {
               c.value = null;
               c.formula = null;
               c.sharedFormula = null;
            });
         }
      }

      mergesToShift.forEach(m => {
          namSheet.mergeCells(m.top + shiftRows, m.left, m.bottom + shiftRows, m.right);
      });

      let foundRow = null;
      let foundCol = 12;
      let mergeRight = 12;
      namSheet.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if(cell.value && typeof cell.value === 'string' && cell.value.toUpperCase().includes('TRƯỞNG')) {
            if (!foundRow) {
              foundRow = rowNumber;
              foundCol = colNumber;
              mergeRight = colNumber;
              
              Object.values(namSheet._merges || {}).forEach(m => {
                if (m.model.top <= rowNumber && m.model.bottom >= rowNumber && m.model.left <= colNumber && m.model.right >= colNumber) {
                  mergeRight = m.model.right;
                }
              });
            }
          }
        });
      });

      if (foundRow) {
        const foundColChar = String.fromCharCode(64 + foundCol);
        namSheet.getCell(foundColChar + (foundRow + 4)).value = leaderName;
        namSheet.getCell(foundColChar + (foundRow + 4)).font = { name: 'Times New Roman', size: 12, bold: true };
        namSheet.getCell(foundColChar + (foundRow + 4)).alignment = { horizontal: 'center' };
        
        if (mergeRight > foundCol) {
          const rightColChar = String.fromCharCode(64 + mergeRight);
          try {
            namSheet.mergeCells(`${foundColChar}${foundRow+4}:${rightColChar}${foundRow+4}`);
          } catch(e) {}
        }
      }
    }

    const filename = `Ket_qua_danh_gia_${manager.username}_Nam_${targetYear}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Fetch all periods
    const periods = await ReviewPeriod.findAll({
      order: [['startDate', 'DESC']],
      include: [
        {
          model: Template,
          attributes: ['id', 'name']
        },
        {
          model: Review,
          as: 'Reviews',
          where: { revieweeId: userId },
          required: false,
          include: [{ model: User, as: 'Reviewer', attributes: ['id', 'fullName'] }]
        }
      ]
    });

    res.status(200).json(periods);
  } catch (error) {
    console.error('Error in getMyReviews:', error);
    res.status(500).json({ message: error.message });
  }
};

const AdmZip = require('adm-zip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const exportDraftDocx = async (req, res) => {
  try {
    const { templateId, scores, notes, totalScore, metadata } = req.body;
    
    console.log('[EXPORT-DOCX] templateId:', templateId);
    console.log('[EXPORT-DOCX] totalScore:', totalScore);
    console.log('[EXPORT-DOCX] metadata:', JSON.stringify(metadata));
    
    if (!templateId) {
      return res.status(400).json({ message: 'Thiếu thông tin template' });
    }
    
    if (!scores || scores.length === 0) {
      return res.status(400).json({ message: 'Không có dữ liệu điểm để xuất' });
    }

    const template = await Template.findByPk(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Không tìm thấy mẫu biểu' });
    }

    let zip;
    if (template.fileData) {
      zip = new AdmZip(Buffer.from(template.fileData, 'base64'));
    } else if (template.filePath && require('fs').existsSync(template.filePath)) {
      zip = new AdmZip(template.filePath);
    } else {
      return res.status(404).json({ message: 'Không tìm thấy file mẫu biểu trên server' });
    }
    const docXml = zip.readAsText('word/document.xml');
    const doc = new DOMParser().parseFromString(docXml, 'text/xml');
    
    const tables = doc.getElementsByTagName('w:tbl');
    let scoringTable = null;
    
    for (let i = 0; i < tables.length; i++) {
      const trs = tables[i].getElementsByTagName('w:tr');
      if (trs.length > 0) {
        let headerText = '';
        const headerCells = trs[0].getElementsByTagName('w:tc');
        for (let j = 0; j < headerCells.length; j++) {
           const tNodes = headerCells[j].getElementsByTagName('w:t');
           for (let k = 0; k < tNodes.length; k++) headerText += tNodes[k].textContent;
        }
        if (headerText.includes('Nội dung tiêu chí') || headerText.includes('Điểm chuẩn')) {
          scoringTable = tables[i];
          break;
        }
      }
    }

    if (!scoringTable) {
      return res.status(400).json({ message: 'Không tìm thấy bảng chấm điểm trong file mẫu' });
    }

    const trs = scoringTable.getElementsByTagName('w:tr');

    // Step 1: Build groups by analyzing vMerge on TT column (col 0) in the XML
    // Groups: rows sharing the same vMerge restart→continue block, or standalone rows
    const groups = []; // { startRow, rowCount }
    
    for (let i = 1; i < trs.length; i++) {
      const cells = trs[i].getElementsByTagName('w:tc');
      if (cells.length === 0) continue;
      
      const ttText = getCellText(cells[0]).trim().toUpperCase();
      if (ttText.includes('TỔNG ĐIỂM')) continue; // Skip total row
      
      // Check vMerge on TT cell (col 0)
      let vMerge = 'none';
      const tcPr = cells[0].getElementsByTagName('w:tcPr')[0];
      if (tcPr) {
        const vm = tcPr.getElementsByTagName('w:vMerge')[0];
        if (vm) vMerge = vm.getAttribute('w:val') || 'continue';
      }
      
      if (vMerge === 'restart') {
        // Start of a new merged group — count continuation rows
        let count = 1;
        for (let j = i + 1; j < trs.length; j++) {
          const jCells = trs[j].getElementsByTagName('w:tc');
          if (jCells.length === 0) break;
          const jTcPr = jCells[0].getElementsByTagName('w:tcPr')[0];
          if (!jTcPr) break;
          const jVm = jTcPr.getElementsByTagName('w:vMerge')[0];
          if (!jVm) break;
          const jVal = jVm.getAttribute('w:val') || 'continue';
          if (jVal === 'continue') {
            count++;
          } else {
            break;
          }
        }
        groups.push({ startRow: i, rowCount: count });
        i += count - 1; // Skip over continuation rows
      } else if (vMerge === 'none') {
        // Standalone row (not merged)
        groups.push({ startRow: i, rowCount: 1 });
      }
      // 'continue' rows are handled within the restart block above
    }

    console.log('[EXPORT-DOCX] Groups found:', groups.length, '| Scores to fill:', scores.length);

    // Step 2: Fill scores into groups using the same shouldMerge logic as templateController
    let scoreIdx = 0;
    
    for (const group of groups) {
      if (scoreIdx >= scores.length) break;
      
      const { startRow, rowCount } = group;
      const xmlRow = trs[startRow];
      const xmlCells = xmlRow.getElementsByTagName('w:tc');
      if (xmlCells.length < 4) continue;
      
      if (rowCount > 1) {
        // Multi-row group — check shouldMerge (same as templateController)
        const diemChuanText = getCellText(xmlCells[2]).trim();
        
        let shouldMerge = false;
        if (diemChuanText.length > 0) {
          shouldMerge = true;
        } else if (startRow + 1 < trs.length) {
          const nextCells = trs[startRow + 1].getElementsByTagName('w:tc');
          if (nextCells.length > 1) {
            const nextText = getCellText(nextCells[1]).trim(); // col 1 = Nội dung (col 0 is merged)
            if (nextText.startsWith('-') || nextText.startsWith('+') || nextText.startsWith('•')) {
              shouldMerge = true;
            }
          }
        }
        
        if (shouldMerge) {
          // MERGED: One score for the entire group
          const scoreVal = scores[scoreIdx] || '';
          const noteVal = (notes && notes[scoreIdx]) || '';
          
          console.log(`[EXPORT] MERGE rows ${startRow}-${startRow + rowCount - 1}: score="${scoreVal}"`);
          
          injectTextToCell(doc, xmlCells[3], scoreVal);
          applyVMerge(doc, xmlCells[3], 'restart');
          if (xmlCells.length > 4) {
            injectTextToCell(doc, xmlCells[4], noteVal);
            applyVMerge(doc, xmlCells[4], 'restart');
          }
          
          for (let j = 1; j < rowCount; j++) {
            const subCells = trs[startRow + j].getElementsByTagName('w:tc');
            if (subCells.length > 3) { clearCell(doc, subCells[3]); applyVMerge(doc, subCells[3], 'continue'); }
            if (subCells.length > 4) { clearCell(doc, subCells[4]); applyVMerge(doc, subCells[4], 'continue'); }
          }
          scoreIdx++;
        } else {
          // NOT MERGED: Parent row + children with sub-category grouping
          const parentScoreVal = scores[scoreIdx] || '';
          const parentNoteVal = (notes && notes[scoreIdx]) || '';
          
          console.log(`[EXPORT] PARENT row ${startRow}: score="${parentScoreVal}" (${rowCount - 1} children)`);
          injectTextToCell(doc, xmlCells[3], parentScoreVal);
          if (xmlCells.length > 4) injectTextToCell(doc, xmlCells[4], parentNoteVal);
          scoreIdx++;
          
          // Process children with sub-category awareness
          let j = 1;
          while (j < rowCount) {
            if (scoreIdx >= scores.length) break;
            const childRow = startRow + j;
            const childCells = trs[childRow].getElementsByTagName('w:tc');
            if (childCells.length < 4) { j++; continue; }
            
            const childContent = getCellText(childCells[1]).trim(); // col 1 = Nội dung
            const isSubCategory = /^[0-9]+\.[0-9]+/.test(childContent);
            
            if (isSubCategory) {
              // Count how many bullet-point rows follow this sub-category
              let subMergeCount = 1; // starts with the sub-category row itself
              for (let k = j + 1; k < rowCount; k++) {
                const kCells = trs[startRow + k].getElementsByTagName('w:tc');
                if (kCells.length < 2) break;
                const kText = getCellText(kCells[1]).trim();
                // Stop if we hit another sub-category or non-bullet
                if (/^[0-9]+\.[0-9]+/.test(kText)) break;
                if (kText.startsWith('-') || kText.startsWith('+') || kText.startsWith('•')) {
                  subMergeCount++;
                } else {
                  break;
                }
              }
              
              const subScore = scores[scoreIdx] || '';
              const subNote = (notes && notes[scoreIdx]) || '';
              
              if (subMergeCount > 1) {
                // Merge sub-category with its bullet children
                console.log(`[EXPORT]   SUB-CAT row ${childRow} MERGE ${subMergeCount} rows: score="${subScore}"`);
                injectTextToCell(doc, childCells[childCells.length - 2], subScore);
                applyVMerge(doc, childCells[childCells.length - 2], 'restart');
                if (childCells.length > 4) {
                  injectTextToCell(doc, childCells[childCells.length - 1], subNote);
                  applyVMerge(doc, childCells[childCells.length - 1], 'restart');
                }
                scoreIdx++;
                
                // Skip the individual bullet scores (they're merged into sub-cat)
                for (let k = 1; k < subMergeCount; k++) {
                  scoreIdx++; // consume the bullet score from scores array
                  const bulletCells = trs[startRow + j + k].getElementsByTagName('w:tc');
                  if (bulletCells.length > 3) {
                    clearCell(doc, bulletCells[bulletCells.length - 2]);
                    applyVMerge(doc, bulletCells[bulletCells.length - 2], 'continue');
                  }
                  if (bulletCells.length > 4) {
                    clearCell(doc, bulletCells[bulletCells.length - 1]);
                    applyVMerge(doc, bulletCells[bulletCells.length - 1], 'continue');
                  }
                }
                
                j += subMergeCount;
              } else {
                // Sub-category with no bullet children — single cell
                console.log(`[EXPORT]   SUB-CAT row ${childRow} SINGLE: score="${subScore}"`);
                injectTextToCell(doc, childCells[childCells.length - 2], subScore);
                if (childCells.length > 4) injectTextToCell(doc, childCells[childCells.length - 1], subNote);
                scoreIdx++;
                j++;
              }
            } else {
              // Regular child row (not a sub-category)
              const childScore = scores[scoreIdx] || '';
              const childNote = (notes && notes[scoreIdx]) || '';
              console.log(`[EXPORT]   CHILD row ${childRow}: score="${childScore}"`);
              injectTextToCell(doc, childCells[childCells.length - 2], childScore);
              if (childCells.length > 4) injectTextToCell(doc, childCells[childCells.length - 1], childNote);
              scoreIdx++;
              j++;
            }
          }
        }
      } else {
        // Single row — just fill the score
        const scoreVal = scores[scoreIdx] || '';
        const noteVal = (notes && notes[scoreIdx]) || '';
        console.log(`[EXPORT] SINGLE row ${startRow}: score="${scoreVal}"`);
        injectTextToCell(doc, xmlCells[3], scoreVal);
        if (xmlCells.length > 4) injectTextToCell(doc, xmlCells[4], noteVal);
        scoreIdx++;
      }
    }

    // Now write Metadata and Total Score.
    const paragraphs = doc.getElementsByTagName('w:p');
    let commanderHeaderFound = false;
    let commanderNameFilled = false;
    let emptyParagraphsAfterHeader = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const tNodes = p.getElementsByTagName('w:t');
      
      if (tNodes.length === 0) {
        // Handle commander name placement with space for signature
        if (commanderHeaderFound && !commanderNameFilled && metadata?.commander) {
          emptyParagraphsAfterHeader++;
          // Skip 3 empty lines for signature, put name on the 4th
          if (emptyParagraphsAfterHeader === 4) {
            const r = doc.createElement('w:r');
            const rPr = doc.createElement('w:rPr');
            const b = doc.createElement('w:b');
            const rFonts = doc.createElement('w:rFonts');
            rFonts.setAttribute('w:ascii', 'Times New Roman');
            rFonts.setAttribute('w:hAnsi', 'Times New Roman');
            rPr.appendChild(b);
            rPr.appendChild(rFonts);
            const sz = doc.createElement('w:sz');
            sz.setAttribute('w:val', '28'); // 14pt
            rPr.appendChild(sz);
            r.appendChild(rPr);
            
            const t = doc.createElement('w:t');
            t.textContent = metadata.commander;
            r.appendChild(t);
            p.appendChild(r);
            
            // Align to the right to match signature area on the right half
            let pPr = p.getElementsByTagName('w:pPr')[0];
            if (!pPr) { pPr = doc.createElement('w:pPr'); p.insertBefore(pPr, p.firstChild); }
            
            let jc = pPr.getElementsByTagName('w:jc')[0];
            if (!jc) { jc = doc.createElement('w:jc'); pPr.appendChild(jc); }
            jc.setAttribute('w:val', 'right');

            // Decrease right margin slightly to move it back right by ~3 spaces
            let ind = pPr.getElementsByTagName('w:ind')[0];
            if (!ind) { ind = doc.createElement('w:ind'); pPr.appendChild(ind); }
            ind.setAttribute('w:right', '2500'); // Approx 1.7 inches from right
            
            let spacing = pPr.getElementsByTagName('w:spacing')[0];
            if (!spacing) { spacing = doc.createElement('w:spacing'); pPr.appendChild(spacing); }
            spacing.setAttribute('w:line', '240');
            spacing.setAttribute('w:lineRule', 'auto');
            
            commanderNameFilled = true;
            console.log(`[EXPORT] Filled Commander Name at P[${i}] aligned RIGHT`);
          }
        }
        continue;
      }

      let pText = '';
      for (let j = 0; j < tNodes.length; j++) pText += tNodes[j].textContent;

      let matchType = null; // 'team', 'name', 'rank', 'date', 'score', 'class'
      let header = '';
      let value = '';

      // 1. Team Name (ĐỘI)
      if (pText.includes('ĐỘI') && (pText.includes('…') || pText.includes('.'))) {
        matchType = 'team';
        header = 'ĐỘI ';
        // Strip redundant "Đội" or "ĐỘI" from value
        let teamVal = (metadata?.teamName || '').trim();
        teamVal = teamVal.replace(/^Đội\s+/i, '');
        value = ' ' + teamVal.toUpperCase();
      }
      // 2. Full Name (Họ và tên:)
      else if (pText.includes('Họ và tên:')) {
        matchType = 'name';
        header = 'Họ và tên: ';
        value = ' ' + (metadata?.fullName || '');
      }
      // 3. Rank/Position (Cấp bậc - Chức vụ:)
      else if (pText.includes('Cấp bậc') && pText.includes('Chức vụ')) {
        matchType = 'rank';
        header = 'Cấp bậc - Chức vụ: ';
        const rankPos = `${metadata?.rank || ''} - ${metadata?.position || ''}`.trim().replace(/^ - | - $/g, '');
        value = ' ' + rankPos;
      }
      // 4. Month/Year
      else if (pText.includes('Tháng') && pText.includes('năm') && (pText.includes('…') || pText.includes('.'))) {
        matchType = 'date';
        header = 'Tháng ';
        value = ` ${metadata?.month || ''} năm ${metadata?.year || ''}`;
      }
      // 5. Classification (Xếp loại:)
      else if (pText.includes('Xếp loại:')) {
        matchType = 'class';
        header = 'Xếp loại: ';
        value = ' ' + (metadata?.classification || '');
      }
      // 6. Total Score
      else if (pText.toUpperCase().includes('TỔNG ĐIỂM')) {
        matchType = 'score';
        header = pText.match(/TỔNG ĐIỂM\s*[:：]?/i)?.[0] || 'TỔNG ĐIỂM: ';
        value = ' ' + totalScore;
      }

      // 7. Commander Header
      if (pText.trim() === 'CHỈ HUY ĐỘI') {
        commanderHeaderFound = true;
      }

      if (matchType) {
        // Try to capture original font size and style from the paragraph or first run
        let originalSz = '28'; // Default to 14pt if not found
        let originalFonts = { ascii: 'Times New Roman', hAnsi: 'Times New Roman' };
        
        const pPr = p.getElementsByTagName('w:pPr')[0];
        if (pPr) {
          const sz = pPr.getElementsByTagName('w:sz')[0];
          if (sz) originalSz = sz.getAttribute('w:val');
          const rFonts = pPr.getElementsByTagName('w:rFonts')[0];
          if (rFonts) {
            originalFonts.ascii = rFonts.getAttribute('w:ascii') || 'Times New Roman';
            originalFonts.hAnsi = rFonts.getAttribute('w:hAnsi') || 'Times New Roman';
          }
        }
        
        if (tNodes.length > 0) {
          const firstR = tNodes[0].parentNode;
          const rPr = firstR.getElementsByTagName('w:rPr')[0];
          if (rPr) {
            const sz = rPr.getElementsByTagName('w:sz')[0];
            if (sz) originalSz = sz.getAttribute('w:val');
          }
        }

        // Clear all runs and recreate them
        while (p.getElementsByTagName('w:r').length > 0) {
          p.removeChild(p.getElementsByTagName('w:r')[0]);
        }
        
        // 1. Header Run (Normal)
        const r1 = doc.createElement('w:r');
        const rPr1 = doc.createElement('w:rPr');
        const rFonts1 = doc.createElement('w:rFonts');
        rFonts1.setAttribute('w:ascii', originalFonts.ascii);
        rFonts1.setAttribute('w:hAnsi', originalFonts.hAnsi);
        rPr1.appendChild(rFonts1);
        const sz1 = doc.createElement('w:sz');
        sz1.setAttribute('w:val', originalSz);
        rPr1.appendChild(sz1);
        r1.appendChild(rPr1);

        const t1 = doc.createElement('w:t');
        t1.setAttribute('xml:space', 'preserve');
        t1.textContent = header;
        r1.appendChild(t1);
        p.appendChild(r1);
        
        // 2. Value Run (Bold except for Date)
        const r2 = doc.createElement('w:r');
        const rPr2 = doc.createElement('w:rPr');
        
        // Bold if not date
        if (matchType !== 'date') {
          const b2 = doc.createElement('w:b');
          rPr2.appendChild(b2);
        }

        const rFonts2 = doc.createElement('w:rFonts');
        rFonts2.setAttribute('w:ascii', originalFonts.ascii);
        rFonts2.setAttribute('w:hAnsi', originalFonts.hAnsi);
        rPr2.appendChild(rFonts2);
        const sz2 = doc.createElement('w:sz');
        sz2.setAttribute('w:val', originalSz);
        rPr2.appendChild(sz2);
        r2.appendChild(rPr2);
        const t2 = doc.createElement('w:t');
        t2.setAttribute('xml:space', 'preserve');
        t2.textContent = value;
        r2.appendChild(t2);
        p.appendChild(r2);
        
        console.log(`[EXPORT] Replaced ${matchType} with value: "${value}" (Bold: ${matchType !== 'date'})`);
      }
    }

    const updatedXml = new XMLSerializer().serializeToString(doc);
    zip.updateFile('word/document.xml', Buffer.from(updatedXml));
    
    const fileBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="Ban_Danh_Gia_Xuat.docx"');
    
    res.send(fileBuffer);
  } catch (error) {
    console.error('Error generating docx:', error);
    res.status(500).json({ message: 'Lỗi server khi xuất file docx', error: error.message });
  }
};

function injectTextToCell(doc, tc, text) {
  let tcPr = null;
  for(let k=0; k<tc.childNodes.length; k++) {
    if(tc.childNodes[k].nodeName === 'w:tcPr') {
      tcPr = tc.childNodes[k].cloneNode(true);
      break;
    }
  }
  
  // Clear the cell
  while (tc.firstChild) tc.removeChild(tc.firstChild);
  if (tcPr) tc.appendChild(tcPr);
  
  const p = doc.createElement('w:p');
  const pPr = doc.createElement('w:pPr');
  const jc = doc.createElement('w:jc');
  jc.setAttribute('w:val', 'center');
  pPr.appendChild(jc);
  p.appendChild(pPr);
  
  const r = doc.createElement('w:r');
  const rPr = doc.createElement('w:rPr');
  const b = doc.createElement('w:b');
  rPr.appendChild(b);
  
  // Apply font to match template typical styling
  const rFonts = doc.createElement('w:rFonts');
  rFonts.setAttribute('w:ascii', 'Times New Roman');
  rFonts.setAttribute('w:hAnsi', 'Times New Roman');
  rFonts.setAttribute('w:cs', 'Times New Roman');
  rPr.appendChild(rFonts);
  
  const sz = doc.createElement('w:sz');
  sz.setAttribute('w:val', '24'); // 12pt
  rPr.appendChild(sz);
  
  r.appendChild(rPr);
  
  const t = doc.createElement('w:t');
  t.textContent = text;
  r.appendChild(t);
  
  p.appendChild(r);
  tc.appendChild(p);
}

function getCellText(tc) {
  let text = '';
  const tNodes = tc.getElementsByTagName('w:t');
  for (let i = 0; i < tNodes.length; i++) text += tNodes[i].textContent;
  return text;
}

function applyVMerge(doc, tc, type) {
  // type: 'restart' or 'continue'
  let tcPr = null;
  for (let k = 0; k < tc.childNodes.length; k++) {
    if (tc.childNodes[k].nodeName === 'w:tcPr') {
      tcPr = tc.childNodes[k];
      break;
    }
  }
  
  if (!tcPr) {
    tcPr = doc.createElement('w:tcPr');
    tc.insertBefore(tcPr, tc.firstChild);
  }
  
  // Remove existing vMerge if any
  const existing = tcPr.getElementsByTagName('w:vMerge');
  while (existing.length > 0) {
    tcPr.removeChild(existing[0]);
  }
  
  const vMerge = doc.createElement('w:vMerge');
  if (type === 'restart') {
    vMerge.setAttribute('w:val', 'restart');
  }
  // For 'continue', no attribute needed (bare <w:vMerge/> means continue)
  
  tcPr.appendChild(vMerge);
}

function clearCell(doc, tc) {
  let tcPr = null;
  for (let k = 0; k < tc.childNodes.length; k++) {
    if (tc.childNodes[k].nodeName === 'w:tcPr') {
      tcPr = tc.childNodes[k].cloneNode(true);
      break;
    }
  }
  
  while (tc.firstChild) tc.removeChild(tc.firstChild);
  if (tcPr) tc.appendChild(tcPr);
  
  // Add an empty paragraph (required for valid docx)
  const p = doc.createElement('w:p');
  tc.appendChild(p);
}

module.exports = { 
  submitPersonalReview,
  getTeamReviews,
  approveReview,
  exportTeamExcel,
  exportDraftDocx,
  getMyReviews
};
