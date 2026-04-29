const { ReviewPeriod } = require('../models');

const getAllReviewPeriods = async (req, res) => {
  try {
    const periods = await ReviewPeriod.findAll();
    res.status(200).json(periods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReviewPeriodById = async (req, res) => {
  try {
    const period = await ReviewPeriod.findByPk(req.params.id);
    if (!period) return res.status(404).json({ message: 'Review Period not found' });
    res.status(200).json(period);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createReviewPeriod = async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const period = await ReviewPeriod.create({ name, startDate, endDate, status });
    res.status(201).json(period);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateReviewPeriod = async (req, res) => {
  try {
    const period = await ReviewPeriod.findByPk(req.params.id);
    if (!period) return res.status(404).json({ message: 'Review Period not found' });
    
    const { name, startDate, endDate, status } = req.body;
    await period.update({ name, startDate, endDate, status });
    res.status(200).json(period);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteReviewPeriod = async (req, res) => {
  try {
    const period = await ReviewPeriod.findByPk(req.params.id);
    if (!period) return res.status(404).json({ message: 'Review Period not found' });
    
    await period.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAllReviewPeriods, getReviewPeriodById, createReviewPeriod, updateReviewPeriod, deleteReviewPeriod };
