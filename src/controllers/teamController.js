const { Team, User } = require('../models');

exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.findAll();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json(team);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    await Team.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    await Team.update(req.body, { where: { id: req.params.id } });
    res.json({ message: 'Team updated' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.assignLeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    // Demote current leaders
    await User.update(
      { position: 'Cán bộ', role: 'Employee' },
      { where: { teamId: id, position: 'Đội trưởng' } }
    );
    
    // Promote new leader
    if (userId) {
      await User.update(
        { position: 'Đội trưởng', role: 'Manager' },
        { where: { id: userId } }
      );
    }
    
    res.json({ message: 'Leader assigned successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
