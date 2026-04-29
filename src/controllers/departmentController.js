const { Department } = require('../models');

const getAllDepartments = async (req, res) => {
  try {
    const departments = await Department.findAll();
    res.status(200).json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.status(200).json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;
    const department = await Department.create({ name, description });
    res.status(201).json(department);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found' });
    
    const { name, description } = req.body;
    await department.update({ name, description });
    res.status(200).json(department);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ message: 'Department not found' });
    
    await department.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAllDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment };
