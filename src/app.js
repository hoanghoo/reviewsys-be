const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const userRoutes = require('./routes/userRoutes');
const reviewPeriodRoutes = require('./routes/reviewPeriodRoutes');
const templateRoutes = require('./routes/templateRoutes');
const teamRoutes = require('./routes/teamRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/review-periods', reviewPeriodRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/teams', teamRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
