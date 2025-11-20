/**
 * PostgreSQL Example - Basic Usage
 * Demonstrates how to use SecureNodeAuth with PostgreSQL database
 */

require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('../src/index');

const app = express();
app.use(express.json());

// Initialize SecureNodeAuth with PostgreSQL
const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres', // Use PostgreSQL instead of MySQL
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'secure_node_auth_test',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'your_access_secret_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_change_in_production',
  },
  security: {
    bcryptRounds: 10,
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutes
  },
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('Connecting to PostgreSQL...');
    await auth.init();
    console.log('✅ PostgreSQL connected successfully!');
    console.log('✅ Tables created/verified');

    // Mount auth routes
    app.use('/auth', auth.router());

    // Public route
    app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to SecureNodeAuth with PostgreSQL!',
        database: 'PostgreSQL',
        endpoints: {
          register: 'POST /auth/register',
          login: 'POST /auth/login',
          refresh: 'POST /auth/refresh',
          profile: 'GET /auth/me (protected)',
          logout: 'POST /auth/logout (protected)',
        },
      });
    });

    // Protected route - Get user profile
    app.get('/api/profile', auth.middleware(), async (req, res) => {
      try {
        const user = await auth.getUserById(req.user.userId);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Remove password from response
        delete user.password;

        res.json({
          success: true,
          user,
        });
      } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
      }
    });

    // Protected route - Update profile
    app.patch('/api/profile', auth.middleware(), async (req, res) => {
      try {
        const { firstName, lastName } = req.body;

        await auth.updateProfile(req.user.userId, {
          firstName,
          lastName,
        });

        res.json({
          success: true,
          message: 'Profile updated successfully',
        });
      } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Example: Direct PostgreSQL query
    app.get('/api/stats', auth.middleware(), async (req, res) => {
      try {
        const pool = auth.getPool();

        // PostgreSQL uses $1, $2 for parameterized queries
        const result = await pool.query(
          'SELECT COUNT(*) as total FROM "secure_auth_users" WHERE "isActive" = $1',
          [true]
        );

        res.json({
          success: true,
          stats: {
            totalActiveUsers: parseInt(result.rows[0].total),
            database: 'PostgreSQL',
          },
        });
      } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });

    // Start Express server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`\n📚 Try these commands:\n`);
      console.log(`# Register a new user`);
      console.log(`curl -X POST http://localhost:${PORT}/auth/register \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"email":"test@example.com","password":"SecurePass123!"}'`);
      console.log(`\n# Login`);
      console.log(`curl -X POST http://localhost:${PORT}/auth/login \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{"email":"test@example.com","password":"SecurePass123!"}'`);
      console.log(`\n# Get profile (use token from login)`);
      console.log(`curl http://localhost:${PORT}/api/profile \\`);
      console.log(`  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await auth.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await auth.close();
  process.exit(0);
});

// Start the server
startServer();
