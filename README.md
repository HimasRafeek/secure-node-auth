# 🔐 Secure Node Auth

> Blazing fast, zero-config MySQL authentication system with JWT. Set up secure auth in seconds!

[![npm version](https://img.shields.io/npm/v/secure-node-auth.svg)](https://www.npmjs.com/package/secure-node-auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/secure-node-auth.svg)](https://nodejs.org)

## ✨ Features

- ⚡ **Zero Configuration** - Works out of the box with sensible defaults
- 🔒 **Production-Ready Security** - Bcrypt hashing, JWT tokens, rate limiting, account lockout
- 🚀 **Lightning Fast** - Built on mysql2 with connection pooling and optimized queries
- 🎨 **Highly Customizable** - Add custom fields, hooks, and configurations
- 🔄 **Auto Schema Setup** - Automatically creates tables, indexes, and relationships
- 🎯 **Express Ready** - Pre-built routes and middleware
- 📦 **Refresh Tokens** - Secure token rotation with blacklisting
- 🛡️ **Attack Protection** - Rate limiting, SQL injection protection, brute force prevention
- 🔌 **Extensible** - Plugin system with before/after hooks
- 📝 **TypeScript Support** - Full type definitions included

## 📦 Installation

```bash
npm install secure-node-auth
```

**Dependencies:**
- `mysql2` - MySQL client
- `jsonwebtoken` - JWT token generation
- `bcrypt` - Password hashing
- `validator` - Input validation
- `express` - Web framework (peer dependency)

## 🚀 Quick Start

### Basic Setup (3 lines!)

```javascript
const SecureNodeAuth = require('secure-node-auth');

const auth = new SecureNodeAuth({
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: 'myapp'
  }
});

await auth.init(); // Auto-creates tables!

// Use with Express
app.use('/auth', auth.router());
```

That's it! You now have a complete authentication system with:
- ✅ User registration
- ✅ Login with JWT
- ✅ Token refresh
- ✅ Password change
- ✅ Profile management
- ✅ Logout (single/all devices)

## 📖 Usage Examples

### Complete Express Server

```javascript
require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

// Initialize auth system
const auth = new SecureNodeAuth({
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
});

await auth.init();

// Mount auth routes
app.use('/auth', auth.router());

// Protected route example
app.get('/api/profile', auth.middleware(), async (req, res) => {
  const user = await auth.getUserById(req.user.userId);
  res.json({ user });
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

### Adding Custom Fields

```javascript
const auth = new SecureNodeAuth({ /* config */ });

// Add custom fields BEFORE init()
auth.addField({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  required: false,
  unique: true
});

auth.addField({
  name: 'companyName',
  type: 'VARCHAR(255)',
  required: false
});

auth.addField({
  name: 'subscriptionTier',
  type: "ENUM('free', 'premium', 'enterprise')",
  defaultValue: 'free'
});

await auth.init();

// Now register with custom fields
await auth.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  phoneNumber: '+1234567890',
  companyName: 'Tech Corp',
  subscriptionTier: 'premium'
});
```

### Using Hooks

```javascript
// Before/after registration
auth.on('beforeRegister', async (userData) => {
  console.log('New user signing up:', userData.email);
  // Add custom validation, check blacklist, etc.
});

auth.on('afterRegister', async (result) => {
  console.log('User registered:', result.user.email);
  // Send welcome email, create user profile, etc.
  await sendWelcomeEmail(result.user.email);
});

// Before/after login
auth.on('beforeLogin', async ({ email }) => {
  console.log('Login attempt:', email);
});

auth.on('afterLogin', async (result) => {
  console.log('Successful login:', result.user.email);
  // Track analytics, update last login, etc.
});
```

### Manual Authentication Flow

```javascript
// Register
const { user, tokens } = await auth.register({
  email: 'john@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe'
});

// Login
const login = await auth.login('john@example.com', 'SecurePass123!');
console.log(login.tokens.accessToken);
console.log(login.tokens.refreshToken);

// Verify token
const decoded = await auth.verifyAccessToken(login.tokens.accessToken);
console.log(decoded.userId, decoded.email);

// Refresh access token
const { accessToken } = await auth.refreshToken(login.tokens.refreshToken);

// Change password
await auth.changePassword(userId, 'OldPass123!', 'NewPass456!');

// Logout
await auth.logout(refreshToken);

// Logout all devices
await auth.logoutAll(userId);
```

## 🔧 Configuration Options

```javascript
const auth = new SecureNodeAuth({
  // Database connection
  connection: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'myapp',
    port: 3306,
    connectionLimit: 10
  },

  // JWT configuration
  jwt: {
    accessSecret: 'your-access-secret',
    refreshSecret: 'your-refresh-secret',
    accessExpiresIn: '15m',    // 15 minutes
    refreshExpiresIn: '7d'      // 7 days
  },

  // Security settings
  security: {
    bcryptRounds: 10,           // Higher = more secure, slower
    maxLoginAttempts: 5,        // Account lockout threshold
    lockoutTime: 900000,        // 15 minutes in milliseconds
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true
  },

  // Custom table names
  tables: {
    users: 'my_users',
    refreshTokens: 'my_tokens',
    loginAttempts: 'my_login_attempts'
  }
});
```

## 📡 API Endpoints

When you mount `auth.router()`, these endpoints are automatically available:

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | ❌ |
| POST | `/login` | Login user | ❌ |
| POST | `/refresh` | Refresh access token | ❌ |
| POST | `/logout` | Logout (revoke token) | ❌ |
| POST | `/logout-all` | Logout all devices | ✅ |
| GET | `/me` | Get current user | ✅ |
| PATCH | `/me` | Update user profile | ✅ |
| POST | `/change-password` | Change password | ✅ |
| POST | `/verify` | Verify token | ❌ |
| GET | `/health` | Health check | ❌ |

### Request/Response Examples

**Register:**
```javascript
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Response
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG...",
      "expiresIn": "15m"
    }
  }
}
```

**Login:**
```javascript
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "tokens": { ... }
  }
}
```

## 🛡️ Security Features

### Password Security
- ✅ Bcrypt hashing (configurable rounds)
- ✅ Minimum length requirements
- ✅ Complexity requirements (uppercase, numbers, special chars)
- ✅ Common password blacklist

### Account Protection
- ✅ Brute force protection (rate limiting)
- ✅ Account lockout after failed attempts
- ✅ Automatic lockout expiration
- ✅ Login attempt tracking

### Token Security
- ✅ Separate access and refresh tokens
- ✅ Short-lived access tokens (15m default)
- ✅ Token revocation support
- ✅ Logout from all devices
- ✅ Automatic token cleanup

### Database Security
- ✅ Parameterized queries (SQL injection protection)
- ✅ Connection pooling
- ✅ Indexed queries for performance
- ✅ Foreign key constraints

## 🏗️ Database Schema

The package automatically creates these tables:

**secure_auth_users**
```sql
- id (PRIMARY KEY)
- email (UNIQUE, INDEXED)
- password (HASHED)
- firstName
- lastName
- emailVerified
- isActive
- createdAt
- updatedAt
+ your custom fields
```

**secure_auth_refresh_tokens**
```sql
- id (PRIMARY KEY)
- userId (FOREIGN KEY)
- token
- revoked
- expiresAt (INDEXED)
- createdAt
```

**secure_auth_login_attempts**
```sql
- id (PRIMARY KEY)
- email (INDEXED)
- success
- ipAddress
- userAgent
- attemptedAt
```

## 🎣 Hooks System

Available hooks:
- `beforeRegister` - Before user registration
- `afterRegister` - After successful registration
- `beforeLogin` - Before login attempt
- `afterLogin` - After successful login
- `beforeTokenRefresh` - Before token refresh
- `afterTokenRefresh` - After token refresh

```javascript
auth.on('afterRegister', async (result) => {
  // Your custom logic
  await sendWelcomeEmail(result.user.email);
  await createUserProfile(result.user.id);
});
```

## 🔌 Middleware Usage

```javascript
// Protect single route
app.get('/api/protected', auth.middleware(), (req, res) => {
  console.log(req.user); // { userId, email, iat, exp }
  res.json({ message: 'Protected data' });
});

// Protect multiple routes
app.use('/api', auth.middleware());

// Custom role-based middleware
const requireAdmin = async (req, res, next) => {
  const user = await auth.getUserById(req.user.userId);
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

app.get('/api/admin', auth.middleware(), requireAdmin, (req, res) => {
  res.json({ message: 'Admin only' });
});
```

## 🧪 Testing

```bash
# Install dependencies
npm install

# Run example server
npm run example

# The server will start on http://localhost:3000
```

Test endpoints with curl:
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

## 📚 Advanced Topics

### Environment Variables

Create a `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=myapp
DB_PORT=3306

JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=10
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000

PORT=3000
```

### Token Cleanup

```javascript
// Clean up expired tokens (run periodically)
await auth.db.cleanupExpiredTokens(auth.options.tables.refreshTokens);

// With cron job
const cron = require('node-cron');
cron.schedule('0 0 * * *', async () => {
  await auth.db.cleanupExpiredTokens(auth.options.tables.refreshTokens);
  console.log('Cleaned up expired tokens');
});
```

### Direct Database Access

```javascript
// Get raw database pool for custom queries
const pool = auth.db.getPool();

const [rows] = await pool.execute(
  'SELECT COUNT(*) as total FROM secure_auth_users WHERE isActive = ?',
  [true]
);

console.log('Active users:', rows[0].total);
```

## 📚 Additional Guides

- 📖 [Accessing User-Specific Data](docs/USER_DATA_ACCESS.md) - Complete guide on protecting routes and accessing user's posts, orders, etc.
- 🔄 [Authentication Flow Diagram](docs/FLOW_DIAGRAM.md) - Visual guide showing how authentication works
- ⚡ [Quick Reference](docs/QUICK_REFERENCE_USER_DATA.md) - Common patterns cheat sheet
- 🚀 [Getting Started](docs/GETTING_STARTED.md) - Step-by-step setup guide
- 🔒 [Security Documentation](SECURITY.md) - **Comprehensive security features and best practices**
- 📋 [Security Audit Report](AUDIT-REPORT.md) - **Expert-level security audit results (49 issues resolved)**

## 🔐 Security Features

This package has undergone **5 rounds of comprehensive security audits** and implements industry best practices:

- ✅ **SQL Injection Protection**: Parameterized queries + escaped identifiers
- ✅ **Token Hashing**: SHA-256 hashing of refresh tokens in database
- ✅ **Email Normalization**: Prevents duplicate accounts via case variations
- ✅ **Audit Logging**: Configurable logging for all security events
- ✅ **Brute Force Protection**: Account lockout after failed attempts
- ✅ **Password Security**: Bcrypt with configurable rounds (4-31)
- ✅ **Input Validation**: Multi-layer validation and sanitization
- ✅ **Secure Configuration**: Validated defaults with safe fallbacks

**Security Standards Compliance**: OWASP Top 10, NIST Framework, PCI-DSS, GDPR

See [SECURITY.md](SECURITY.md) for complete security documentation and [AUDIT-REPORT.md](AUDIT-REPORT.md) for detailed audit findings.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © 2025

## 🔗 Links

- [GitHub Repository](https://github.com/HimasRafeek/secure-node-auth)
- [NPM Package](https://www.npmjs.com/package/secure-node-auth)
- [Issue Tracker](https://github.com/HimasRafeek/secure-node-auth/issues)

## 💡 Support

If you find this package helpful, please consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting new features
- 📖 Improving documentation

---

**Built with ❤️ for the Node.js community**
