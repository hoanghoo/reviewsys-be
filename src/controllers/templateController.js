const { Template, ReviewPeriod } = require('../models');
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
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// We don't need a separate memory upload anymore since we use it directly above
// But keep uploadMemory if it's used elsewhere
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
      fileData: req.file.buffer.toString('base64')
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

  // NORMALIZATION: Ensure each row has exactly the expected number of cells (5 for main, 4 for sub-rows)
  // This removes extra empty columns on the left that Mammoth sometimes adds  // Get true header cell count
  const headerCellCount = $('thead tr').first().find('th, td').length || 5;

  let activeTtRowspan = 0;
  $('tbody tr').each((i, el) => {
    let $row = $(el);
    let cells = $row.find('td');
    
    let expectedCells = activeTtRowspan > 0 ? (headerCellCount - 1) : headerCellCount;
    
    let originalLength = cells.length;
    // If Mammoth added extra empty cells on the left, remove them
    while (cells.length > expectedCells) {
      $(cells[0]).remove();
      cells = $row.find('td');
    }
    
    // In case Mammoth merged cells and we have FEWER than expected, pad on the right
    while (cells.length < expectedCells) {
      $row.append('<td></td>');
      cells = $row.find('td');
    }
    
    // Update rowspan tracker
    if (expectedCells === headerCellCount) {
      let rs = parseInt($(cells[0]).attr('rowspan')) || 1;
      if (rs > 1) activeTtRowspan = rs - 1;
    } else {
      if (activeTtRowspan > 0) activeTtRowspan--;
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
        const scoreCell = $(cells[cells.length - (headerCellCount === 6 ? 3 : 2)]);
        const noteCell = $(cells[cells.length - (headerCellCount === 6 ? 2 : 1)]);

        scoreCell.attr('rowspan', rowspan);
        noteCell.attr('rowspan', rowspan);
        if (headerCellCount === 6) { $(cells[cells.length - 1]).attr('rowspan', rowspan); }

        scoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${myId}" data-parent-id="${myParentId}" data-row-index="${i}" />`);
        noteCell.html(`<input type="number" min="-99" max="99" class="score-input commander-score" data-id="${myId}_commander" data-parent-id="${myParentId ? myParentId + '_commander' : ''}" data-row-index="${i}" />`);
        if (headerCellCount === 6) {
          const realNoteCell = $(cells[cells.length - 1]);
          realNoteCell.html(`<input type="text" class="note-input" data-id="${myId}_note" data-parent-id="${myParentId ? myParentId + '_note' : ''}" data-row-index="${i}" />`);
        }

        for (let j = 1; j < rowspan; j++) {
          const nextRow = $(rows[i + j]);
          if (nextRow.length) {
            const nextCells = nextRow.find('td');
            if (nextCells.length > 2) {
              nextRow.find('td').slice(2).remove(); // Keep only Nội dung and Điểm chuẩn
            }
          }
        }

        i += rowspan - 1;
        continue;
      } else {
        // DO NOT MERGE: This is a Parent group with individual Children rows (e.g., III.1 or III.2)
        const parentScoreCell = $(cells[cells.length - (headerCellCount === 6 ? 3 : 2)]);
        const parentNoteCell = $(cells[cells.length - (headerCellCount === 6 ? 2 : 1)]);

        parentScoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${myId}" data-parent-id="${myParentId}" readonly placeholder="..." data-row-index="${i}" />`);
        parentNoteCell.html(`<input type="number" min="-99" max="99" class="score-input commander-score" data-id="${myId}_commander" data-parent-id="${myParentId ? myParentId + '_commander' : ''}" readonly placeholder="..." data-row-index="${i}" />`);
        if (headerCellCount === 6) {
          const realNoteCell = $(cells[cells.length - 1]);
          realNoteCell.html(`<input type="text" class="note-input" data-id="${myId}_note" data-parent-id="${myParentId ? myParentId + '_note' : ''}" data-row-index="${i}" />`);
        }

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

              const childScoreCell = $(nextCells[nextCells.length - (headerCellCount === 6 ? 3 : 2)]);
              const childNoteCell = $(nextCells[nextCells.length - (headerCellCount === 6 ? 2 : 1)]);
              childScoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${childId}" data-parent-id="${childParentId}" data-row-index="${i + j}" readonly />`);
              childNoteCell.html(`<input type="number" min="-99" max="99" class="score-input commander-score" data-id="${childId}_commander" data-parent-id="${childParentId}_commander" data-row-index="${i + j}" readonly />`);
              if (headerCellCount === 6) {
                const childRealNoteCell = $(nextCells[nextCells.length - 1]);
                childRealNoteCell.html(`<input type="text" class="note-input" data-id="${childId}_note" data-parent-id="${childParentId}_note" data-row-index="${i + j}" />`);
              }
            }
          }
        }

        i += rowspan - 1;
        continue;
      }
    }

    // Normal, single unmerged row (e.g., II.2, II.3)
    const scoreCell = $(cells[cells.length - (headerCellCount === 6 ? 3 : 2)]);
    const noteCell = $(cells[cells.length - (headerCellCount === 6 ? 2 : 1)]);

    scoreCell.html(`<input type="number" min="-99" max="99" class="score-input" data-id="${myId}" data-parent-id="${myParentId}" data-row-index="${i}" />`);
    noteCell.html(`<input type="number" min="-99" max="99" class="score-input commander-score" data-id="${myId}_commander" data-parent-id="${myParentId ? myParentId + '_commander' : ''}" data-row-index="${i}" />`);
    if (headerCellCount === 6) {
      const realNoteCell = $(cells[cells.length - 1]);
      realNoteCell.html(`<input type="text" class="note-input" data-id="${myId}_note" data-parent-id="${myParentId ? myParentId + '_note' : ''}" data-row-index="${i}" />`);
    }
  }

  // After generating all inputs, we can make any input that has children readonly
  // We do this by injecting a small script or processing it in frontend. 
  // We'll let the frontend handle the readonly and calculation based on data-id and data-parent-id.
  // Normalize column count across all rows to match the header (redundant now due to NORMALIZATION above, but keeping safe fallback)
  // REMOVED: Safe fallback was actually breaking rowspans because sub-rows have fewer cells than headerCellCount.
  // Set all inputs to disabled in preview mode to prevent editing
  $('input').attr('disabled', true);
  $('input').removeAttr('readonly');
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

    if (!template.fileData && !template.filePath) {
      return res.status(404).json({ message: 'Template data is missing' });
    }

    let source;
    if (template.fileData) {
      source = { buffer: Buffer.from(template.fileData, 'base64') };
    } else if (template.filePath && fs.existsSync(template.filePath)) {
      source = { path: template.filePath }; // Legacy fallback
    } else {
      return res.status(404).json({ message: 'File template không tồn tại trên máy chủ' });
    }

    const html = await convertDocxToHtml(source);

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
    const templates = await Template.findAll({
      attributes: { exclude: ['fileData'] } // Don't send huge base64 string when listing templates
    });
    res.status(200).json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    // Check if the template is currently used by any ReviewPeriod
    const inUseCount = await ReviewPeriod.count({ where: { templateId: template.id } });
    if (inUseCount > 0) {
      return res.status(400).json({ message: 'Không thể xóa biểu mẫu đang được sử dụng bởi đợt đánh giá!' });
    }

    if (template.filePath && fs.existsSync(template.filePath)) {
      fs.unlinkSync(template.filePath); // Legacy cleanup
    }

    await template.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { convertDocxToHtml,
  upload,
  uploadMemory,
  uploadTemplate,
  previewTemplate,
  previewTemplateById,
  getAllTemplates,
  deleteTemplate
};
