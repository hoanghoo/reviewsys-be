const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

let adminToken;
let templateId;

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

describe('Template API', () => {
  it('should upload a template', async () => {
    const filePath = path.join(__dirname, 'dummy.docx');
    fs.writeFileSync(filePath, 'dummy content');

    const res = await request(app)
      .post('/api/templates/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Review Form Template')
      .field('type', 'Word')
      .attach('file', filePath);
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toEqual('Review Form Template');
    templateId = res.body.id;

    fs.unlinkSync(filePath);
  });

  it('should get all templates', async () => {
    const res = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toEqual(1);
  });

  it('should delete a template', async () => {
    const res = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.statusCode).toEqual(204);
  });
});
