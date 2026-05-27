const fs = require('fs');
const path = './src/controllers/reviewController.js';
let code = fs.readFileSync(path, 'utf8');

const downloadFunc = `
const downloadAttachment = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const review = await Review.findByPk(reviewId, {
      include: [
        { model: User, as: 'Reviewee', include: [{ model: Team }] },
        { model: ReviewPeriod }
      ]
    });

    if (!review || !review.attachmentFile) {
      return res.status(404).json({ message: 'Không tìm thấy file đính kèm' });
    }

    const filePath = path.join(__dirname, '../../uploads', review.attachmentFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File đính kèm không còn tồn tại trên hệ thống' });
    }

    const removeAccents = (str) => {
      return str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    };

    const periodName = review.ReviewPeriod ? review.ReviewPeriod.name.replace(/\\s+/g, '_') : 'KyDanhGia';
    const teamName = (review.Reviewee && review.Reviewee.Team) ? review.Reviewee.Team.shortName.replace(/\\s+/g, '_') : 'Doi';
    const userName = review.Reviewee ? removeAccents(review.Reviewee.fullName).replace(/\\s+/g, '_') : 'NhanSu';

    const ext = path.extname(review.attachmentFile);
    const newFileName = \`\${periodName}_\${teamName}_\${userName}_Document\${ext}\`;

    res.download(filePath, newFileName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
`;

if (!code.includes('const downloadAttachment')) {
  // Add it before module.exports
  code = code.replace(
    'module.exports = {',
    downloadFunc + '\nmodule.exports = {'
  );
  // Also export it
  code = code.replace(
    'module.exports = {',
    'module.exports = {\n  downloadAttachment,'
  );
  fs.writeFileSync(path, code);
  console.log('Added downloadAttachment');
} else {
  console.log('Already added');
}
