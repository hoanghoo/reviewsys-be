const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Department, Team } = require('../src/models');
const jwt = require('jsonwebtoken');

let adminToken;
let userId;
let testTeamId;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  const dept = await Department.create({ name: 'Phòng 1' });
  const team = await Team.create({ shortName: 'Đội 1', fullName: 'Đội Cảnh sát số 1', departmentId: dept.id });
  testTeamId = team.id;

  const admin = await User.create({
    username: 'admin_test',
    password: 'password',
    fullName: 'Admin Test',
    role: 'Admin',
    departmentId: dept.id,
    teamId: team.id
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

  it('should download import template', async () => {
    const res = await request(app)
      .get('/api/users/import-template')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('should preview imported file and detect warnings', async () => {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.columns = [
      { header: 'Họ và tên', key: 'fullName' },
      { header: 'Cấp bậc', key: 'rank' },
      { header: 'Chức vụ', key: 'position' },
      { header: 'Đội', key: 'team' }
    ];
    worksheet.addRow({ fullName: 'Trần Văn Tiến', rank: 'Thiếu úy', position: 'Cán bộ', team: 'Đội 1' });
    worksheet.addRow({ fullName: 'Nguyễn Văn Hùng', rank: 'Thiếu úy', position: 'Trưởng phòng', team: 'Ban Lãnh đạo' });
    const buffer = await workbook.xlsx.writeBuffer();

    const res = await request(app)
      .post('/api/users/import-preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, 'test.xlsx');

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(2);
    expect(res.body[0].fullName).toEqual('Trần Văn Tiến');
    expect(res.body[0].username).toEqual('tvtien');
    expect(res.body[1].fullName).toEqual('Nguyễn Văn Hùng');
  });

  it('should submit imported users', async () => {
    const users = [
      {
        fullName: 'Trần Văn Tiến',
        rank: 'Thiếu úy',
        position: 'Cán bộ',
        teamName: 'Đội 1',
        teamId: testTeamId,
        username: 'tvtien',
        password: 'securePassword123',
        isValid: true
      }
    ];

    const res = await request(app)
      .post('/api/users/import-submit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ users });

    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('should delete a user', async () => {
    const res = await request(app)
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
      
    expect(res.statusCode).toEqual(204);
  });
});
