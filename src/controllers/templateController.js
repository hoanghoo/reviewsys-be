const { Template } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');

const uploadDir = path.join(__dirname, '../../storage/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || path.extname(file.originalname).toLowerCase() === '.docx') {
    cb(null, true);
  } else {
    cb(new Error('Chỉ hỗ trợ file .docx'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

const uploadMemory = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

const uploadTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or file invalid' });
    }

    const { name } = req.body;
    
    const template = await Template.create({
      name,
      type: 'Word', // always Word now
      filePath: req.file.path
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const cheerio = require('cheerio');

const convertDocxToHtml = async (source) => {
  const result = await mammoth.convertToHtml(source);
  let html = result.value;

  const tables = html.match(/<table>[\s\S]*?<\/table>/g) || [];
  const mainTableHtml = tables.find(t => t.includes('<thead>')) || tables[1] || '';

  if (!mainTableHtml) return html;

  const $ = cheerio.load(mainTableHtml);

  // Remove the TỔNG ĐIỂM row (it's shown in the fixed footer)
  $('tr').each((i, el) => {
    if ($(el).text().toUpperCase().includes('TỔNG ĐIỂM')) {
      $(el).remove();
    }
  });

  const rows = $('tbody tr').toArray();
  let currentRomanId = null;
  let currentArabicId = null;

  for (let i = 0; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td');
    
    // We need at least 3 cells to safely identify Điểm chuẩn, Điểm chấm, Ghi chú
    if (cells.length < 3) continue;

    const firstCell = cells.first();
    const firstCellText = firstCell.text().trim().toUpperCase();
    const rowspan = parseInt(firstCell.attr('rowspan')) || 1;

    // Detect Hierarchy level
    const isRoman = /^[IVX]+$/.test(firstCellText);
    const isArabic = /^[0-9]+$/.test(firstCellText);

    let myId = `row_${i}`;
    let myParentId = 'root';

    if (isRoman) {
      currentRomanId = `roman_${i}`;
      currentArabicId = null;
      myId = currentRomanId;
      myParentId = 'root';
    } else if (isArabic) {
      currentArabicId = `arabic_${i}`;
      myId = currentArabicId;
      myParentId = currentRomanId || 'root';
    } else {
      myParentId = currentArabicId || currentRomanId || 'root';
    }

    if (rowspan > 1) {
      // SMART MERGE LOGIC v2:
      let shouldMerge = false;
      const diemChuanCell = $(cells[cells.length - 3]);
      const diemChuanText = diemChuanCell.text().trim();

      if (diemChuanText.length > 0) {
        shouldMerge = true;
      } else {
        const nextRow = $(rows[i + 1]);
        if (nextRow.length) {
          const nextCells = nextRow.find('td');
          const noiDungText = $(nextCells[0]).text().trim();
          if (noiDungText.startsWith('-') || noiDungText.startsWith('+') || noiDungText.startsWith('•')) {
            shouldMerge = true;
          }
        }
      }

      if (shouldMerge) {
        const scoreCell = $(cells[cells.length - 2]);
        const noteCell = $(cells[cells.length - 1]);

        scoreCell.attr('rowspan', rowspan);
        noteCell.attr('rowspan', rowspan);

        scoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${myId}" data-parent-id="${myParentId}" />`);
        noteCell.html(`<input type="text" class="note-input" />`);

        for (let j = 1; j < rowspan; j++) {
          const nextRow = $(rows[i + j]);
          if (nextRow.length) {
            const nextCells = nextRow.find('td');
            if (nextCells.length > 2) {
              nextRow.find('td').slice(-(nextCells.length - 2)).remove();
            }
          }
        }
        
        i += rowspan - 1;
        continue;
      } else {
        // DO NOT MERGE: This is a Parent group with individual Children rows (e.g., III.1 or III.2)
        const parentScoreCell = $(cells[cells.length - 2]);
        const parentNoteCell = $(cells[cells.length - 1]);
        
        parentScoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${myId}" data-parent-id="${myParentId}" readonly placeholder="..." />`);
        parentNoteCell.html(`<input type="text" class="note-input" />`);

        let currentSubParentId = null;

        for (let j = 1; j < rowspan; j++) {
          const nextRow = $(rows[i + j]);
          if (nextRow.length) {
            const nextCells = nextRow.find('td');
            if (nextCells.length >= 2) {
              // Usually in an unmerged sub-row, the 'Nội dung' is the first cell since the TT column is merged
              const noiDungText = $(nextCells[0]).text().trim();
              
              // Check if it's a sub-category like "2.1.", "1.1", etc.
              const isSubCategory = /^[0-9]+\.[0-9]+/.test(noiDungText);
              
              const childId = `${myId}_child_${j}`;
              let childParentId = myId;

              if (isSubCategory) {
                currentSubParentId = childId;
                childParentId = myId; // A sub-category belongs to the main Arabic group
              } else {
                // If it's a bullet point (or something else), it belongs to the last seen sub-category if any
                if (currentSubParentId) {
                  childParentId = currentSubParentId;
                } else {
                  childParentId = myId;
                }
              }

              const childScoreCell = $(nextCells[nextCells.length - 2]);
              const childNoteCell = $(nextCells[nextCells.length - 1]);
              childScoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${childId}" data-parent-id="${childParentId}" />`);
              childNoteCell.html('<input type="text" class="note-input" />');
            }
          }
        }
        
        i += rowspan - 1;
        continue;
      }
    }

    // Normal, single unmerged row (e.g., II.2, II.3)
    const scoreCell = $(cells[cells.length - 2]);
    const noteCell = $(cells[cells.length - 1]);
    
    scoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${myId}" data-parent-id="${myParentId}" />`);
    noteCell.html(`<input type="text" class="note-input" />`);
  }

  // After generating all inputs, we can make any input that has children readonly
  // We do this by injecting a small script or processing it in frontend. 
  // We'll let the frontend handle the readonly and calculation based on data-id and data-parent-id.
  return $.html();
};

const previewTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const html = await convertDocxToHtml({ buffer: req.file.buffer });

    res.status(200).json({
      html: html,
      message: 'Trích xuất bảng thành công!'
    });
  } catch (error) {
    res.status(400).json({ message: 'Không thể đọc file .docx: ' + error.message });
  }
};

const previewTemplateById = async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (!fs.existsSync(template.filePath)) {
      return res.status(404).json({ message: 'File template không tồn tại trên máy chủ' });
    }

    const html = await convertDocxToHtml({ path: template.filePath });

    res.status(200).json({
      html: html,
      name: template.name,
      message: 'Trích xuất bảng thành công!'
    });
  } catch (error) {
    res.status(400).json({ message: 'Không thể đọc file .docx: ' + error.message });
  }
};

const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.findAll();
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    if (fs.existsSync(template.filePath)) {
      fs.unlinkSync(template.filePath);
    }
    
    await template.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  upload,
  uploadMemory,
  uploadTemplate,
  previewTemplate,
  previewTemplateById,
  getAllTemplates,
  deleteTemplate
};
