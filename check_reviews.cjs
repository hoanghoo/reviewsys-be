const { User, Review, Team } = require('./src/models');

async function check() {
  const reviews = await Review.findAll();
  console.log(`Total reviews in DB: ${reviews.length}`);
  for (let r of reviews) {
    console.log(`Review ID: ${r.id}, Period: ${r.reviewPeriodId}, Reviewee: ${r.revieweeId}, Status: ${r.status}`);
  }
}
check().catch(console.error).finally(() => process.exit(0));
