# 🚀 Getting Started with Secure Node Auth

## Prerequisites

Before you begin, ensure you have:
- **Node.js** v14 or higher
- **MySQL** 5.7+ or MariaDB 10.2+
- **npm** or **yarn**

## Step-by-Step Setup

### 1. Create Your Project

```bash
mkdir my-auth-app
cd my-auth-app
npm init -y
```

### 2. Install Secure Node Auth

```bash
npm install secure-node-auth express dotenv
```

### 3. Set Up MySQL Database

Connect to MySQL and create a database:

```sql
CREATE DATABASE myapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

That's it! The package will automatically create all necessary tables.

### 4. Create Environment File

Create `.env` in your project root:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=myapp
DB_PORT=3306

# JWT Secrets (CHANGE THESE!)
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars

# JWT Expiration
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security Settings
BCRYPT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000

# Server
PORT=3000
NODE_ENV=development
```

**⚠️ IMPORTANT:** Generate strong random secrets for production:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Create Your Server

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

// Initialize authentication
const auth = new SecureNodeAuth();

// Initialize and start server
auth.init()
  .then(() => {
    console.log('✅ Auth system initialized');
    
    // Mount auth routes
    app.use('/auth', auth.router());
    
    // Example protected route
    app.get('/api/profile', auth.middleware(), async (req, res) => {
      const user = await auth.getUserById(req.user.userId);
      res.json({ user });
    });
    
    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 Docs: http://localhost:${PORT}/auth/health`);
    });
  })
  .catch(error => {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  });
```

### 6. Run Your Server

```bash
node server.js
```

You should see:
```
✅ Auth system initialized
🚀 Server running on http://localhost:3000
```

### 7. Test Your API

**Register a user:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","firstName":"John"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

Save the `accessToken` from the response!

**Get profile:**
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🎯 What Was Created Automatically?

When you ran `auth.init()`, these tables were created:

1. **secure_auth_users** - User accounts
2. **secure_auth_refresh_tokens** - JWT refresh tokens
3. **secure_auth_login_attempts** - Login attempt tracking

Check them out:
```sql
USE myapp;
SHOW TABLES;
DESCRIBE secure_auth_users;
```

## 📡 Available Endpoints

After mounting `auth.router()` for Express or using `FastifyPlugin` for Fastify, you get these endpoints:

### Core Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Register new user |
| `/auth/login` | POST | Login user |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/logout` | POST | Logout (revoke token) |
| `/auth/logout-all` | POST | Logout all devices (protected) |
| `/auth/me` | GET | Get current user (protected) |
| `/auth/me` | PATCH | Update profile (protected) |
| `/auth/change-password` | POST | Change password (protected) |
| `/auth/verify` | POST | Verify token |
| `/auth/health` | GET | Health check |

### Email Verification (choose one method)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/send-verification-email` | POST | Send verification URL via email |
| `/auth/verify-email` | POST | Verify with URL token |
| `/auth/send-verification-code` 🆕 | POST | Send 6-digit code |
| `/auth/verify-code` 🆕 | POST | Verify with 6-digit code |

### Password Reset (choose one method)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/forgot-password` | POST | Send reset URL via email |
| `/auth/reset-password` | POST | Reset with URL token |
| `/auth/send-password-reset-code` 🆕 | POST | Send 6-digit reset code |
| `/auth/reset-password-with-code` 🆕 | POST | Reset with 6-digit code |

> **💡 Pro Tip:** 6-digit codes are perfect for mobile apps and provide better UX!

## 🎨 Next Steps

### Add Custom Fields

```javascript
const auth = new SecureNodeAuth();

// Add fields BEFORE init()
auth.addField({ 
  name: 'phoneNumber', 
  type: 'VARCHAR(20)',
  unique: true 
});

await auth.init();
```

### Add Custom Logic with Hooks

```javascript
auth.on('afterRegister', async (result) => {
  console.log('New user:', result.user.email);
  // Send welcome email
  // Create user profile
  // Track analytics
});

auth.on('afterLogin', async (result) => {
  console.log('User logged in:', result.user.email);
  // Update last login time
  // Track login location
});
```

### Protect Your Routes

```javascript
// Protect single route
app.get('/api/secret', auth.middleware(), (req, res) => {
  res.json({ secret: 'data', userId: req.user.userId });
});

// Protect all routes under /api
app.use('/api', auth.middleware());
```

### Add Role-Based Access Control

```javascript
// Add role field
auth.addField({ 
  name: 'role', 
  type: "ENUM('user', 'admin')",
  defaultValue: 'user'
});

// Create role middleware
const requireAdmin = async (req, res, next) => {
  const user = await auth.getUserById(req.user.userId);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Use it
app.get('/api/admin', auth.middleware(), requireAdmin, (req, res) => {
  res.json({ message: 'Admin only area' });
});
```

## 🐛 Troubleshooting

### "Cannot connect to MySQL"
- Ensure MySQL is running: `mysql.server start` (Mac) or `net start mysql` (Windows)
- Check credentials in `.env`
- Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`

### "Table already exists"
- Normal on restart - tables are created once
- To reset: Drop database and restart: `DROP DATABASE myapp; CREATE DATABASE myapp;`

### "Invalid token" / "Token expired"
- Access tokens expire after 15 minutes
- Use refresh token to get new access token
- POST to `/auth/refresh` with `refreshToken` in body

### "Too many requests"
- Rate limiting is active (10 requests/15 minutes)
- Wait or disable: `auth.router({ enableRateLimit: false })`

## 📚 Full Documentation

- [README.md](../README.md) - Complete API reference
- [QUICK_START.md](QUICK_START.md) - Quick reference guide
- [SECURITY.md](SECURITY.md) - Security best practices
- [examples/](../examples/) - Working examples

## 💡 Tips

✅ **Do:**
- Use environment variables for secrets
- Generate strong random JWT secrets
- Use HTTPS in production
- Implement rate limiting
- Add logging for security events
- Keep dependencies updated

❌ **Don't:**
- Commit `.env` to git
- Use default JWT secrets in production
- Store tokens in localStorage
- Expose detailed error messages to users
- Allow weak passwords

## 🆘 Need Help?

- Check [examples/](../examples/) for working code
- Read [docs/](../docs/) for detailed guides
- Open an issue on GitHub
- Check existing issues for solutions

## 🎉 You're Ready!

You now have a production-ready authentication system! Start building your app with confidence.

**Happy coding! 🚀**
