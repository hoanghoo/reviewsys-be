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
  for (let i = 0; i < rows.length; i++) {
    const row = $(rows[i]);
    const cells = row.find('td');
    
    if (cells.length === 0) continue;

    // Check if this row starts a TT group (based on the first cell's rowspan)
    const firstCell = cells.first();
    const rowspan = parseInt(firstCell.attr('rowspan')) || 1;

    if (rowspan > 1) {
      // This is the start of a TT group (multiple rows)
      // Apply the same rowspan to the last two columns (Score and Note)
      const scoreCell = $(cells[cells.length - 2]);
      const noteCell = $(cells[cells.length - 1]);

      scoreCell.attr('rowspan', rowspan);
      noteCell.attr('rowspan', rowspan);

      // Inject inputs into these two shared cells
      scoreCell.html('<input type="number" min="0" max="99" class="score-input" />');
      noteCell.html('<input type="text" class="note-input" />');

      // For the next (rowspan - 1) rows, remove their last two cells
      // because they are now covered by the rowspan from this row.
      for (let j = 1; j < rowspan; j++) {
        const nextRow = $(rows[i + j]);
        if (nextRow.length) {
          nextRow.find('td').slice(-2).remove();
        }
      }
      
      // Skip the rows in this group as we've already processed them
      i += rowspan - 1;
    } else {
      // Single row criterion or standard row
      if (cells.length >= 2) {
        const scoreCell = $(cells[cells.length - 2]);
        const noteCell = $(cells[cells.length - 1]);
        
        scoreCell.html('<input type="number" min="0" max="99" class="score-input" />');
        noteCell.html('<input type="text" class="note-input" />');
      }
    }
  }

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
