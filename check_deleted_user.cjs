const { User, Review } = require('./src/models');
async function check() {
  const u = await User.findByPk(4, { paranoid: false }); // In case soft delete is enabled
  console.log('User 4:', u ? 'Exists (Deleted: ' + !!u.deletedAt + ')' : 'Hard deleted');
  
  const reviews = await Review.findAll({ where: { revieweeId: 4 } });
  console.log('Reviews for User 4:', reviews.length);
}
check().catch(console.error).finally(() => process.exit(0));
