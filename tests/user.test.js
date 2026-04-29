const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const jwt = require('jsonwebtoken');

let adminToken;
let userId;

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

describe('User API', () => {
  it('should create a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'emp1', password: 'password', fullName: 'Employee 1', role: 'Employee' });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.username).toEqual('emp1');
    userId = res.body.id;
  });

  it('should get all users', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toEqual(2);
  });

  it('should update a user', async () => {
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Employee 1 Updated', role: 'Manager' });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body.fullName).toEqual('Employee 1 Updated');
    expect(res.body.role).toEqual('Manager');
  });

  it('should delete a user', async () => {
    const res = await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.statusCode).toEqual(204);
  });
});
