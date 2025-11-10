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
await auth.updateUser(userId, updates);
await auth.changePassword(userId, oldPass, newPass);

// Token Management
await auth.refreshToken(refreshToken);
await auth.verifyAccessToken(token);
await auth.logout(refreshToken);
await auth.logoutAll(userId);

// Customization
auth.addField(fieldConfig);
auth.on(hookEvent, callback);
auth.router(options);
auth.middleware();

// Cleanup
await auth.close();
```

## 🎨 Customization Examples

### Add Custom Fields

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
```

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
