const { Template } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

const upload = multer({ storage: storage });

const uploadTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { name, type } = req.body;
    
    const template = await Template.create({
      name,
      type,
      filePath: req.file.path
    });

    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
  uploadTemplate,
  getAllTemplates,
  deleteTemplate
};
