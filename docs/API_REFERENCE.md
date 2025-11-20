# 🎉 Secure Node Auth - Complete Package

## 📁 Project Structure

```
secure-node/
├── src/
│   ├── index.js                    # Main SecureNodeAuth class
│   ├── index.d.ts                  # TypeScript definitions
│   ├── core/
│   │   ├── DatabaseManager.js      # MySQL operations & auto-setup
│   │   ├── TokenService.js         # JWT generation & validation
│   │   └── SecurityService.js      # Password hashing & validation
│   └── middleware/
│       └── AuthRoutes.js           # Express routes & middleware
├── examples/
│   ├── basic-usage.js              # Simple Express server example
│   ├── advanced-usage.js           # Advanced features demo
│   ├── api-examples.js             # API request examples
│   └── config.js                   # Configuration example
├── docs/
│   ├── GETTING_STARTED.md          # Step-by-step setup guide
│   ├── QUICK_START.md              # 5-minute quick start
│   └── SECURITY.md                 # Security best practices
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore rules
├── CHANGELOG.md                    # Version history
├── CONTRIBUTING.md                 # Contribution guidelines
├── LICENSE                         # MIT License
├── package.json                    # NPM package configuration
└── README.md                       # Main documentation
```

## 🚀 Quick Installation

```bash
# 1. Create your project
mkdir my-app && cd my-app
npm init -y

# 2. Install the package
npm install secure-node-auth express dotenv

# 3. Copy example environment file
cp node_modules/secure-node-auth/.env.example .env

# 4. Edit .env with your database credentials

# 5. Create server.js (see below)

# 6. Run
node server.js
```

## 📝 Minimal server.js

```javascript
require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

const auth = new SecureNodeAuth();

auth.init().then(() => {
  app.use('/auth', auth.router());
  app.listen(3000, () => console.log('Server running on port 3000'));
});
```

## ✨ Key Features Summary

### 🔐 Security
- ✅ Bcrypt password hashing (10 rounds default)
- ✅ JWT with access & refresh tokens
- ✅ Account lockout after failed attempts (5 attempts, 15min lockout)
- ✅ Rate limiting (10 requests/15min)
- ✅ SQL injection protection (parameterized queries)
- ✅ Password strength validation
- ✅ Input sanitization

### ⚡ Performance
- ✅ MySQL connection pooling
- ✅ Optimized database indexes
- ✅ Short-lived access tokens (15min)
- ✅ Long-lived refresh tokens (7 days)
- ✅ Automatic token cleanup

### 🎯 Developer Experience
- ✅ Zero configuration needed
- ✅ Auto-creates database tables
- ✅ Express middleware included
- ✅ Pre-built authentication routes
- ✅ Custom fields support
- ✅ Hooks for extensibility
- ✅ TypeScript definitions
- ✅ Comprehensive documentation

## 📡 API Reference

### Authentication Endpoints

```javascript
POST   /auth/register        # Register new user
POST   /auth/login           # Login user  
POST   /auth/refresh         # Refresh access token
POST   /auth/logout          # Logout single session
POST   /auth/logout-all      # Logout all sessions
GET    /auth/me              # Get current user (protected)
PATCH  /auth/me              # Update user profile (protected)
POST   /auth/change-password # Change password (protected)
POST   /auth/verify          # Verify token validity
GET    /auth/health          # Health check
```

### Programmatic API

```javascript
// Initialize
const auth = new SecureNodeAuth(options);
await auth.init();

// User Management
await auth.register(userData);
await auth.login(email, password);
await auth.getUserById(userId);
await auth.getUserByEmail(email);
await auth.updateUser(userId, updates);
await auth.updateProfile(userId, updates);  // Alias for updateUser
await auth.changePassword(userId, oldPass, newPass);
await auth.isAccountLocked(email);
await auth.getUserCount();

// Token Management
await auth.refreshToken(refreshToken);
await auth.verifyAccessToken(token);
await auth.logout(refreshToken);
await auth.logoutAll(userId);

// Email Verification (URL-based)
await auth.sendVerificationEmail(email, verificationUrl);
await auth.verifyEmail(token);
await auth.resendVerificationEmail(email, verificationUrl);

// Email Verification (6-digit code) 🆕
await auth.sendVerificationCode(email, { expiresInMinutes: 10 });
await auth.verifyCode(email, code);

// Check verification status
await auth.isEmailVerified(userId);

// Password Reset (URL-based)
await auth.sendPasswordResetEmail(email, resetUrl);
await auth.resetPassword(token, newPassword);

// Password Reset (6-digit code) 🆕
await auth.sendPasswordResetCode(email, { expiresInMinutes: 15 });
await auth.resetPasswordWithCode(email, code, newPassword);

// Database Maintenance & Utilities
await auth.cleanupExpiredTokens();
await auth.cleanupExpiredLoginAttempts(daysToKeep);
await auth.cleanupRevokedRefreshTokens(daysToKeep);
await auth.performMaintenance(options);
auth.getPool();  // Get raw database pool

// Customization
auth.addField(fieldConfig);
auth.dangerouslyAddColumn(fieldConfig, options);
auth.dangerouslyMigrateSchema(fields, options);
auth.on(hookEvent, callback);
auth.router(options);
auth.middleware();

// Cleanup
await auth.close();
```

## 🎨 Customization Examples

### Add Custom Fields

**Before Initialization (✅ Recommended):**

```javascript
auth.addField({ 
  name: 'phoneNumber', 
  type: 'VARCHAR(20)', 
  unique: true 
});

auth.addField({ 
  name: 'role', 
  type: "ENUM('user', 'admin')", 
  defaultValue: 'user' 
});

await auth.init(); // Tables created with custom fields
```

**After Initialization (⚠️ Dangerous - Runtime Migration):**

```javascript
await auth.init();

// Add single column
await auth.dangerouslyAddColumn({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  unique: true,
}, { confirmed: true });

// Add multiple columns
await auth.dangerouslyMigrateSchema([
  { name: 'age', type: 'INTEGER', defaultValue: 0 },
  { name: 'city', type: 'VARCHAR(100)' },
], { confirmed: true });
```

**📖 See [DANGEROUS_MIGRATIONS.md](DANGEROUS_MIGRATIONS.md) for complete guide.**

### Add Hooks

```javascript
auth.on('afterRegister', async (result) => {
  await sendWelcomeEmail(result.user.email);
});

auth.on('afterLogin', async (result) => {
  await trackAnalytics('login', result.user);
});
```

### Custom Configuration

```javascript
const auth = new SecureNodeAuth({
  connection: { /* MySQL config */ },
  jwt: { 
    accessExpiresIn: '30m',
    refreshExpiresIn: '30d' 
  },
  security: {
    bcryptRounds: 12,
    passwordMinLength: 10
  },
  tables: {
    users: 'app_users',
    refreshTokens: 'app_tokens'
  }
});
```

## 🧪 Testing Your API

### Using curl

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Login  
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Get profile (replace TOKEN)
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### Using JavaScript (fetch)

```javascript
// Register
const register = await fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'SecurePass123!',
    firstName: 'John'
  })
});
const { data } = await register.json();
console.log(data.tokens.accessToken);
```

### Using Postman

1. Import collection from `examples/postman-collection.json`
2. Set environment variables
3. Test all endpoints

## 🔒 Security Best Practices

### Production Checklist

- [ ] Change default JWT secrets
- [ ] Use environment variables
- [ ] Enable HTTPS
- [ ] Use httpOnly cookies for tokens
- [ ] Implement CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring & logging
- [ ] Regular security updates
- [ ] Use strong database passwords
- [ ] Restrict database user permissions

### Generating Strong Secrets

```bash
# Generate 32-byte random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📊 Database Schema

### Users Table (auto-created)
```sql
secure_auth_users
├── id (PRIMARY KEY)
├── email (UNIQUE, INDEXED)
├── password (HASHED)
├── firstName
├── lastName
├── emailVerified
├── isActive
├── createdAt
├── updatedAt
└── [your custom fields]
```

### Tokens Table (auto-created)
```sql
secure_auth_refresh_tokens
├── id (PRIMARY KEY)
├── userId (FOREIGN KEY -> users.id)
├── token (TEXT)
├── revoked (BOOLEAN)
├── expiresAt (BIGINT, INDEXED)
└── createdAt
```

### Login Attempts Table (auto-created)
```sql
secure_auth_login_attempts
├── id (PRIMARY KEY)
├── email (INDEXED)
├── success (BOOLEAN)
├── ipAddress
├── userAgent
└── attemptedAt (INDEXED)
```

## 🛠️ Troubleshooting

### Common Issues

**"Cannot connect to MySQL"**
- Check MySQL is running
- Verify credentials in `.env`
- Ensure database exists

**"Cannot add fields after initialization"**
- Call `addField()` BEFORE `auth.init()`
- For existing databases, use `dangerouslyAddColumn()` (see [DANGEROUS_MIGRATIONS.md](DANGEROUS_MIGRATIONS.md))

**"Invalid token"**
- Token may be expired (15min for access tokens)
- Use refresh token to get new access token

**"Account locked"**
- Too many failed login attempts
- Wait 15 minutes or adjust `lockoutTime`

**"Too many requests"**
- Rate limiting active
- Wait or disable: `auth.router({ enableRateLimit: false })`

## 📚 Documentation Links

- [README.md](../README.md) - Complete documentation
- [GETTING_STARTED.md](GETTING_STARTED.md) - Setup guide
- [QUICK_START.md](QUICK_START.md) - Quick reference
- [SECURITY.md](SECURITY.md) - Security practices
- [examples/](../examples/) - Working examples

## 🔄 Migration Guide

### From Passport.js

```javascript
// Before (Passport.js)
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(...));

// After (secure-node-auth)
const auth = new SecureNodeAuth();
await auth.init();
app.use('/auth', auth.router());
app.use('/api', auth.middleware());
```

### From JWT Manual Implementation

```javascript
// Before (Manual JWT)
jwt.sign(payload, secret);
jwt.verify(token, secret);

// After (secure-node-auth)
const { tokens } = await auth.login(email, password);
const decoded = await auth.verifyAccessToken(tokens.accessToken);
```

## 💰 Package Size

- Core package: ~50KB
- Dependencies: ~5MB (mysql2, bcrypt, etc.)
- No bloat, only essentials

## 🌟 Why Use This Package?

### vs Passport.js
✅ Zero configuration (Passport requires extensive setup)
✅ Auto database setup (Passport doesn't handle storage)
✅ Built-in JWT tokens (Passport needs additional packages)
✅ Modern async/await (Passport uses callbacks)

### vs Auth0/Okta
✅ Self-hosted (no external dependencies)
✅ No monthly costs
✅ Full control over data
✅ No API rate limits

### vs Manual Implementation
✅ Battle-tested security
✅ Time saving (hours → minutes)
✅ Maintained & updated
✅ Comprehensive documentation

## 📋 Complete Method Reference

### Core Authentication Methods

#### `async init()`
Initialize the authentication system. Creates tables, indexes, and sets up the database.
```javascript
await auth.init();
```

#### `async register(userData)`
Register a new user with email and password.
```javascript
const result = await auth.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'John',
  lastName: 'Doe'
});
// Returns: { user, tokens: { accessToken, refreshToken, expiresIn } }
```

#### `async login(email, password)`
Login user with email and password.
```javascript
const result = await auth.login('user@example.com', 'SecurePass123!');
// Returns: { user, tokens: { accessToken, refreshToken, expiresIn } }
```

#### `async refreshToken(refreshToken)`
Get a new access token using a refresh token.
```javascript
const { accessToken } = await auth.refreshToken(refreshToken);
```

#### `async logout(refreshToken)`
Logout from a single session by revoking the refresh token.
```javascript
await auth.logout(refreshToken);
```

#### `async logoutAll(userId)`
Logout from all devices by revoking all user's refresh tokens.
```javascript
await auth.logoutAll(userId);
```

#### `async verifyAccessToken(token)`
Verify and decode a JWT access token.
```javascript
const decoded = await auth.verifyAccessToken(token);
// Returns: { userId, email, iat, exp }
```

### User Management Methods

#### `async getUserById(userId)`
Get user by ID (password excluded).
```javascript
const user = await auth.getUserById(123);
```

#### `async getUserByEmail(email)`
Get user by email address (password excluded).
```javascript
const user = await auth.getUserByEmail('user@example.com');
```

#### `async updateUser(userId, updates)`
Update user profile data.
```javascript
await auth.updateUser(userId, {
  firstName: 'Jane',
  phoneNumber: '+1234567890'
});
```

#### `async updateProfile(userId, updates)`
Alias for `updateUser()` with clearer naming.
```javascript
await auth.updateProfile(userId, { firstName: 'Jane' });
```

#### `async changePassword(userId, oldPassword, newPassword)`
Change user password (requires current password).
```javascript
await auth.changePassword(userId, 'OldPass123!', 'NewPass456!');
```

#### `async getUserCount()`
Get total number of users (for analytics/dashboards).
```javascript
const count = await auth.getUserCount();
console.log(`Total users: ${count}`);
```

#### `async isAccountLocked(email)`
Check if account is temporarily locked due to failed login attempts.
```javascript
const isLocked = await auth.isAccountLocked('user@example.com');
if (isLocked) {
  console.log('Account is locked. Try again in 15 minutes.');
}
```

### Email Verification Methods

#### `async sendVerificationEmail(email, verificationUrl)`
Send email verification link to user.
```javascript
await auth.sendVerificationEmail(
  'user@example.com',
  'https://myapp.com/verify-email'
);
```

#### `async verifyEmail(token)`
Verify user's email with token from verification link.
```javascript
const result = await auth.verifyEmail(tokenFromURL);
// Returns: { success: true, userId, message }
```

#### `async resendVerificationEmail(email, verificationUrl)`
Resend verification email (if previous one expired or not received).
```javascript
await auth.resendVerificationEmail(
  'user@example.com',
  'https://myapp.com/verify-email'
);
```

#### `async sendVerificationCode(email, options)` 🆕
Send 6-digit verification code via email (alternative to URL-based verification).
- **Parameters:**
  - `email` (string): User's email address
  - `options.expiresInMinutes` (number, optional): Code expiration time (default: 10 minutes)
- **Returns:** `{ success, messageId, code }`
- **Best for:** Mobile apps, better UX

```javascript
// Send verification code
await auth.sendVerificationCode('user@example.com', {
  expiresInMinutes: 10
});

// Express.js example
app.post('/api/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    await auth.sendVerificationCode(email);
    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Custom template
const auth = new SecureNodeAuth({
  emailTemplates: {
    verificationCode: {
      subject: 'Your Verification Code',
      html: (code, email, minutes) => `Your code: ${code}`
    }
  }
});
```

#### `async verifyCode(email, code)` 🆕
Verify email using 6-digit code (alternative to token-based verification).
- **Parameters:**
  - `email` (string): User's email address
  - `code` (string): 6-digit verification code
- **Returns:** `{ success, userId, message }`
- **Security:** Code must be exactly 6 digits, expires in 10 minutes (default)

```javascript
// Verify code
await auth.verifyCode('user@example.com', '123456');

// Express.js example
app.post('/api/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    const result = await auth.verifyCode(email, code);
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Error handling
try {
  await auth.verifyCode('user@example.com', '123456');
} catch (error) {
  if (error.message === 'Invalid or expired verification code') {
    // Code wrong or expired
  } else if (error.message === 'Code must be exactly 6 digits') {
    // Invalid format
  }
}
```

#### `async isEmailVerified(userId)`
Check if user's email has been verified.
```javascript
const verified = await auth.isEmailVerified(userId);
```

### Password Reset Methods

#### `async sendPasswordResetEmail(email, resetUrl)`
Send password reset link to user's email (URL-based reset).
```javascript
await auth.sendPasswordResetEmail(
  'user@example.com',
  'https://myapp.com/reset-password'
);
```

#### `async sendPasswordResetCode(email, options)` 🆕
Send 6-digit password reset code via email (alternative to URL-based reset).
- **Parameters:**
  - `email` (string): User's email address
  - `options.expiresInMinutes` (number, optional): Code expiration time (default: 15 minutes)
- **Returns:** `{ success, messageId, message, code }`
- **Best for:** Mobile apps, better UX

```javascript
// Send reset code
await auth.sendPasswordResetCode('user@example.com', {
  expiresInMinutes: 15
});

// Custom template
const auth = new SecureNodeAuth({
  emailTemplates: {
    passwordResetCode: {
      subject: 'Your Reset Code',
      html: (code, email, minutes) => `Your code: ${code}`
    }
  }
});
```

#### `async resetPassword(token, newPassword)`
Reset password using token from reset email link.
```javascript
await auth.resetPassword(tokenFromURL, 'NewSecurePass123!');
```

#### `async resetPasswordWithCode(email, code, newPassword)` 🆕
Reset password using 6-digit code (alternative to token-based reset).
- **Parameters:**
  - `email` (string): User's email address
  - `code` (string): 6-digit reset code
  - `newPassword` (string): New password (must meet security requirements)
- **Returns:** `{ success, message }`
- **Security:** All user sessions are revoked after successful reset

```javascript
// Reset password with code
await auth.resetPasswordWithCode(
  'user@example.com',
  '987654',
  'NewSecurePass123!'
);

// Express.js example
app.post('/api/reset-password-code', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    await auth.resetPasswordWithCode(email, code, newPassword);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Database Maintenance Methods

#### `async cleanupExpiredTokens()`
Remove expired email verification tokens from database.
```javascript
const deleted = await auth.cleanupExpiredTokens();
console.log(`Cleaned up ${deleted} expired tokens`);
```

#### `async cleanupExpiredLoginAttempts(daysToKeep = 30)`
Remove old login attempt records (default: keeps 30 days).
```javascript
const deleted = await auth.cleanupExpiredLoginAttempts(60);
console.log(`Cleaned up ${deleted} old login attempts`);
```

#### `async cleanupRevokedRefreshTokens(daysToKeep = 7)`
Remove old revoked refresh tokens (default: keeps 7 days).
```javascript
const deleted = await auth.cleanupRevokedRefreshTokens(14);
console.log(`Cleaned up ${deleted} revoked tokens`);
```

#### `async performMaintenance(options)`
Run all cleanup operations at once (recommended for cron jobs).
```javascript
const result = await auth.performMaintenance({
  cleanupLoginAttempts: true,
  loginAttemptsRetentionDays: 90,
  cleanupVerificationTokens: true,
  cleanupRevokedTokens: true,
  revokedTokensRetentionDays: 14
});
console.log(`Maintenance completed in ${result.duration}ms`);
console.log(`Deleted: ${result.loginAttemptsDeleted} attempts, ${result.verificationTokensDeleted} tokens, ${result.revokedTokensDeleted} revoked`);
```

#### `getPool()`
Get raw database connection pool for advanced queries.
⚠️ **Use with caution** - bypasses security checks.
```javascript
const pool = auth.getPool();
const [rows] = await pool.query('SELECT * FROM users WHERE isActive = ?', [true]);
```

### Schema Customization Methods

#### `addField(fieldConfig)`
Add custom field to user schema (must be called BEFORE `init()`).
```javascript
auth.addField({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  required: false,
  unique: true
});
await auth.init();
```

#### `async dangerouslyAddColumn(fieldConfig, options)`
⚠️ **DANGEROUS**: Add column to existing database at runtime.
Requires `confirmed: true` safety flag.
```javascript
await auth.dangerouslyAddColumn({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  unique: true
}, { confirmed: true });
```

#### `async dangerouslyMigrateSchema(fields, options)`
⚠️ **DANGEROUS**: Add multiple columns to existing database.
Supports transactions (PostgreSQL only).
```javascript
await auth.dangerouslyMigrateSchema([
  { name: 'age', type: 'INTEGER', defaultValue: 0 },
  { name: 'city', type: 'VARCHAR(100)' }
], { confirmed: true, useTransaction: true });
```

📖 **See [DANGEROUS_MIGRATIONS.md](DANGEROUS_MIGRATIONS.md) for complete migration guide.**

### Hook Methods

#### `on(event, callback)`
Register hooks for lifecycle events.
```javascript
auth.on('afterRegister', async (result) => {
  console.log('New user registered:', result.user.email);
  await sendWelcomeEmail(result.user);
});

auth.on('afterLogin', async (result) => {
  await trackAnalytics('login', result.user);
});
```

**Available Events:**
- `beforeRegister` - Before user registration
- `afterRegister` - After successful registration
- `beforeLogin` - Before user login
- `afterLogin` - After successful login
- `beforeTokenRefresh` - Before token refresh
- `afterTokenRefresh` - After token refresh

### Express/Fastify Integration

#### `router(options)`
Get Express router with pre-built authentication routes.
```javascript
app.use('/auth', auth.router({
  prefix: '/api',
  enableRateLimit: true
}));
```

#### `middleware()`
Get authentication middleware for protecting routes.
```javascript
app.get('/api/protected', auth.middleware(), (req, res) => {
  res.json({ user: req.user });
});
```

### Utility Methods

#### `async close()`
Close database connection gracefully.
```javascript
await auth.close();
```

## 🤝 Support & Community

- 📖 Documentation: [README.md](../README.md)
- 🐛 Issues: GitHub Issues
- 💡 Discussions: GitHub Discussions
- 📧 Email: support@yourpackage.com

## 📄 License

MIT License - See [LICENSE](../LICENSE)

## 🙏 Credits

Built with:
- mysql2 - Fast MySQL client
- jsonwebtoken - JWT implementation
- bcrypt - Password hashing
- validator - Input validation
- Express - Web framework

---

**Ready to build something amazing? Let's go! 🚀**

```bash
npm install secure-node-auth
```
