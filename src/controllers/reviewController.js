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

    if (!manager || (manager.role !== 'Manager' && manager.role !== 'Admin')) {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    const { Op } = require('sequelize');
    let userWhere = { 
      role: { [Op.in]: ['Employee', 'Manager'] },
      id: { [Op.ne]: manager.id } // Don't review self here
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
    if (manager.role === 'Manager') {
      userWhere.departmentId = manager.departmentId;
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
      if (!review || review.status === 'Draft') stats.notStarted++;
      else if (review.status === 'Submitted') stats.submitted++;
      else if (review.status === 'ManagerReviewed') stats.managerReviewed++;
      else if (review.status === 'Completed') stats.completed++;
    });

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

    if (manager.role !== 'Admin' && manager.departmentId !== reviewee.departmentId) {
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
    const { periodId } = req.query;
    if (!periodId) return res.status(400).json({ message: 'Thiếu ID kỳ đánh giá' });

    const manager = await User.findByPk(req.user.id);
    const period = await ReviewPeriod.findByPk(periodId);

    const templatePath = path.join(__dirname, '../../template/overrall.xlsx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ message: 'File template không tồn tại' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1);

    // Fetch reviews for this period and department
    const reviews = await Review.findAll({
      where: { reviewPeriodId: periodId },
      include: [
        {
          model: User,
          as: 'Reviewee',
          where: { departmentId: manager.departmentId }
        }
      ],
      order: [[{ model: User, as: 'Reviewee' }, 'fullName', 'ASC']]
    });

    // Update Header info if needed (PA05, Đội...)
    worksheet.getCell('A2').value = `ĐỘI: ${manager.username.toUpperCase()}`; // Example mapping
    const month = new Date(period.endDate).getMonth() + 1;
    const year = new Date(period.endDate).getFullYear();
    worksheet.getCell('D2').value = `THỰC HIỆN NHIỆM VỤ CỦA CBCS THÁNG ${month} NĂM ${year}`;

    // Fill data starting from Row 6
    let startRow = 6;
    reviews.forEach((review, index) => {
      const rowIndex = startRow + index;
      const row = worksheet.getRow(rowIndex);
      
      const feedbackData = typeof review.feedback === 'string' ? JSON.parse(review.feedback) : (review.feedback || {});

      row.getCell(1).value = index + 1; // STT
      row.getCell(2).value = review.Reviewee.fullName; // Họ và tên
      row.getCell(3).value = Number(feedbackData.part1Score) || 0; // Chuyên môn
      row.getCell(4).value = 0; // Công tác NVCB (Placeholder)
      row.getCell(6).value = Number(feedbackData.part2Score) || 0; // Điểm cộng
      row.getCell(7).value = Number(feedbackData.part3Score) || 0; // Điểm trừ
      
      // The template has formulas in Col 5, 8, 9. 
      // We should preserve them or re-calculate.
      // ExcelJS preserves formulas if we don't overwrite them.
      
      row.commit();
    });

    // Set filename
    const filename = `Ket_qua_danh_gia_${manager.username}_T${month}.xlsx`;
    
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

module.exports = { 
  submitPersonalReview,
  getTeamReviews,
  approveReview,
  exportTeamExcel,
  getMyReviews
};
