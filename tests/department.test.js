const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Department } = require('../src/models');
const jwt = require('jsonwebtoken');

let adminToken;
let departmentId;

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

describe('Department API', () => {
  it('should create a department', async () => {
    const res = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'IT Department', description: 'Tech team' });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toEqual('IT Department');
    departmentId = res.body.id;
  });

  it('should get all departments', async () => {
    const res = await request(app)
      .get('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toEqual(1);
  });

  it('should get a department by id', async () => {
    const res = await request(app)
      .get(`/api/departments/${departmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.statusCode).toEqual(200);
    expect(res.body.name).toEqual('IT Department');
  });

  it('should update a department', async () => {
    const res = await request(app)
      .put(`/api/departments/${departmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Engineering', description: 'Tech team updated' });
      
    expect(res.statusCode).toEqual(200);
    expect(res.body.name).toEqual('Engineering');
  });

  it('should delete a department', async () => {
    const res = await request(app)
      .delete(`/api/departments/${departmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.statusCode).toEqual(204);
  });
});
