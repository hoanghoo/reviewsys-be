const { User, ReviewPeriod } = require('./src/models');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.development' });

async function run() {
  const period = await ReviewPeriod.findOne({ where: { id: 6 } }) || await ReviewPeriod.findOne();
  const tp = await User.findOne({ where: { position: 'Trưởng phòng' } });
  const token = jwt.sign(
    { id: tp.id, username: tp.username, roles: tp.roles, position: tp.position, teamId: tp.teamId, departmentId: tp.departmentId },
    process.env.JWT_SECRET || 'fallback',
    { expiresIn: '1h' }
  );

  try {
    const res = await fetch(`http://localhost:3001/api/reviews/team?periodId=${period.id}&status=Reviewed&teamId=all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log("API Result length:", data.data ? data.data.length : data);
  } catch (e) {
    console.error("API Error:", e.message);
  }
  process.exit(0);
}
run();
