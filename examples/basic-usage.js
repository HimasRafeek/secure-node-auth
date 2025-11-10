require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('../src/index');

const app = express();
app.use(express.json());

// Initialize SecureNodeAuth
const auth = new SecureNodeAuth({
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'secure_node_auth_example',
    port: process.env.DB_PORT || 3306
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET
  }
});

// Add custom fields (BEFORE init())
auth.addField({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  required: false,
  unique: false
});

auth.addField({
  name: 'companyName',
  type: 'VARCHAR(255)',
  required: false
});

// Register hooks
auth.on('afterRegister', async (data) => {
  console.log('✅ New user registered:', data.user.email);
  // You could send welcome email here
});

auth.on('afterLogin', async (data) => {
  console.log('✅ User logged in:', data.user.email);
  // You could log analytics here
});

// Initialize auth system
auth.init()
  .then(() => {
    console.log('🔐 Auth system initialized successfully');
    
    // Mount auth routes
    app.use('/auth', auth.router());
    
    // Example protected route
    app.get('/api/profile', auth.middleware(), async (req, res) => {
      try {
        const user = await auth.getUserById(req.user.userId);
        res.json({ user });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Example admin route with role check
    app.get('/api/admin/users', auth.middleware(), async (req, res) => {
      // You can add role-based access control here
      res.json({ message: 'Admin route - would return all users' });
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`\n📚 API Endpoints:`);
      console.log(`   POST   http://localhost:${PORT}/auth/register`);
      console.log(`   POST   http://localhost:${PORT}/auth/login`);
      console.log(`   POST   http://localhost:${PORT}/auth/refresh`);
      console.log(`   POST   http://localhost:${PORT}/auth/logout`);
      console.log(`   GET    http://localhost:${PORT}/auth/me`);
      console.log(`   PATCH  http://localhost:${PORT}/auth/me`);
      console.log(`   POST   http://localhost:${PORT}/auth/change-password`);
      console.log(`   GET    http://localhost:${PORT}/api/profile (protected)`);
    });
  })
  .catch(error => {
    console.error('❌ Failed to initialize auth system:', error.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await auth.close();
  process.exit(0);
});
