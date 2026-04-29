const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const jwt = require('jsonwebtoken');

let adminToken;
let periodId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const admin = await User.create({
    username: 'admin_test',
    password: 'password',
    fullName: 'Admin Test',
    role: 'Admin'
  });
  adminToken = jwt.sign({ id: admin.id, role: admin.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: 3600 });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Review Period API', () => {
  it('should create a review period', async () => {
    const res = await request(app)
      .post('/api/review-periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Q1 Review', startDate: '2026-01-01', endDate: '2026-03-31', status: 'Open' });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toEqual('Q1 Review');
    periodId = res.body.id;
  });

  it('should get all review periods', async () => {
    const res = await request(app)
      .get('/api/review-periods')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toEqual(1);
  });

  it('should update a review period', async () => {
    const res = await request(app)
      .put(`/api/review-periods/${periodId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Q1 Review Updated', startDate: '2026-01-01', endDate: '2026-03-31', status: 'Closed' });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body.name).toEqual('Q1 Review Updated');
    expect(res.body.status).toEqual('Closed');
  });

  it('should delete a review period', async () => {
    const res = await request(app)
      .delete(`/api/review-periods/${periodId}`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.statusCode).toEqual(204);
  });
});
