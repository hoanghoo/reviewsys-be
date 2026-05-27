const { User, Review } = require('./src/models');
async function check() {
  const u = await User.findOne({ where: { teamId: 1 } });
  if (u) {
    const review = await Review.create({
      reviewPeriodId: 5,
      reviewerId: u.id,
      revieweeId: u.id,
      templateId: 1, // dummy
      feedback: JSON.stringify({ tableData: { scores: [], notes: [] } }),
      score: 85,
      selfScore: 85,
      status: 'Submitted'
    });
    console.log(`Created dummy review for User ${u.fullName} (ID: ${u.id})`);
  }
}
check().catch(console.error).finally(() => process.exit(0));
