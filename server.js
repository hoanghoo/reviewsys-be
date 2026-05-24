const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, envFile) });
dotenv.config(); // fallback to .env if specific doesn't exist

console.log(`Loaded environment: ${process.env.NODE_ENV || 'development'} using ${envFile}`);
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');
const app = require('./src/app');
const { sequelize } = require('./src/models');

const PORT = process.env.PORT || 3001;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully to Supabase.');
    
    // In production, listen on 0.0.0.0 to ensure accessibility
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
      console.log(`📡 Health check: http://0.0.0.0:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Unable to connect to the database or start server:', error);
    process.exit(1); // Exit with failure if we can't connect
  }
};

startServer();
