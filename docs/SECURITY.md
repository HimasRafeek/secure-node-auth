# Security Documentation

## 🔒 Security Features

### Password Security

#### Bcrypt Hashing
- All passwords are hashed using bcrypt with configurable salt rounds (default: 10)
- Passwords are never stored in plain text
- Hashing is one-way and cannot be reversed

```javascript
// Configure bcrypt rounds
const auth = new SecureNodeAuth({
  security: {
    bcryptRounds: 12 // Higher = more secure, slower
  }
});
```

#### Password Requirements
- Minimum length: 8 characters (configurable)
- Requires uppercase letters (configurable)
- Requires numbers (configurable)
- Requires special characters (configurable)
- Checks against common weak passwords

```javascript
const auth = new SecureNodeAuth({
  security: {
    passwordMinLength: 10,
    passwordRequireUppercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true
  }
});
```

### Token Security

#### JWT Implementation
- **Access Tokens**: Short-lived (15 minutes default)
- **Refresh Tokens**: Long-lived (7 days default)
- Separate secrets for access and refresh tokens
- Tokens include user ID and email only (minimal payload)

#### Token Best Practices
```javascript
// Production configuration
const auth = new SecureNodeAuth({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET, // Use env variables
    refreshSecret: process.env.JWT_REFRESH_SECRET, // Never commit secrets
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d'
  }
});
```

#### Token Storage Recommendations

**Frontend (Browser):**
- ❌ **Don't**: Store in localStorage (vulnerable to XSS)
- ✅ **Do**: Use httpOnly cookies
- ✅ **Do**: Use secure cookies in production
- ✅ **Do**: Set SameSite attribute

**Mobile Apps:**
- ✅ Use secure storage (Keychain/Keystore)
- ✅ Encrypt tokens before storage

### Account Protection

#### Brute Force Prevention
```javascript
const auth = new SecureNodeAuth({
  security: {
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000 // 15 minutes
  }
});
```

Features:
- Tracks failed login attempts per email
- Locks account after N failed attempts
- Automatic unlock after timeout
- Resets counter on successful login

#### Rate Limiting
- Built-in rate limiting on all auth endpoints
- Default: 10 requests per 15 minutes
- Configurable per route

```javascript
app.use('/auth', auth.router({
  enableRateLimit: true
}));
```

### Database Security

#### SQL Injection Protection
- All queries use parameterized statements
- No string concatenation in queries
- mysql2 prepared statements

```javascript
// Example: How we prevent SQL injection
const [rows] = await this.pool.execute(
  'SELECT * FROM users WHERE email = ?',
  [email] // Parameters are properly escaped
);
```

#### Connection Security
- Connection pooling prevents connection exhaustion
- Automatic connection cleanup
- Configurable connection limits

### Input Validation

#### Email Validation
- RFC-compliant email validation
- Normalized email addresses (lowercase)
- XSS protection via escaping

#### Data Sanitization
```javascript
// All user inputs are sanitized
const sanitized = validator.escape(userInput.trim());
```

### Session Management

#### Token Revocation
```javascript
// Logout single session
await auth.logout(refreshToken);

// Logout all devices
await auth.logoutAll(userId);
```

#### Token Cleanup
```javascript
// Periodically clean expired tokens
const cron = require('node-cron');
cron.schedule('0 0 * * *', async () => {
  await auth.db.cleanupExpiredTokens(auth.options.tables.refreshTokens);
});
```

## 🛡️ Security Best Practices

### Production Checklist

- [ ] Use strong, unique JWT secrets (32+ characters)
- [ ] Store secrets in environment variables
- [ ] Enable HTTPS only
- [ ] Implement CORS properly
- [ ] Use httpOnly cookies for tokens
- [ ] Enable rate limiting
- [ ] Set up logging and monitoring
- [ ] Implement 2FA (future feature)
- [ ] Regular security audits
- [ ] Keep dependencies updated

### Environment Variables

```env
# Strong secrets (use random generators)
JWT_ACCESS_SECRET=your_64_character_random_string_here_for_access_tokens
JWT_REFRESH_SECRET=your_64_character_random_string_here_for_refresh_tokens

# Database credentials
DB_HOST=your_db_host
DB_USER=app_user  # Use dedicated user, not root
DB_PASSWORD=strong_password_here
DB_NAME=your_database

# Security settings
BCRYPT_ROUNDS=12  # Higher in production
MAX_LOGIN_ATTEMPTS=3
LOCKOUT_TIME=1800000  # 30 minutes
```

### HTTPS Configuration

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('path/to/private-key.pem'),
  cert: fs.readFileSync('path/to/certificate.pem')
};

https.createServer(options, app).listen(443);
```

### CORS Configuration

```javascript
const cors = require('cors');

app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Cookie Configuration

```javascript
// Set access token as httpOnly cookie
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000 // 15 minutes
});
```

## 🚨 Security Incident Response

### If Secrets Are Compromised

1. **Immediate Actions:**
   - Rotate JWT secrets immediately
   - Revoke all existing tokens
   - Force all users to re-authenticate

```javascript
// Rotate secrets
await auth.logoutAll(userId); // For all users

// Update environment variables with new secrets
// Restart application
```

2. **Investigation:**
   - Check access logs
   - Identify compromised accounts
   - Notify affected users

### Login Attempt Monitoring

```javascript
auth.on('beforeLogin', async ({ email }) => {
  // Log all login attempts
  logger.info('Login attempt', { email, timestamp: Date.now() });
});

auth.on('afterLogin', async (result) => {
  // Log successful logins
  logger.info('Successful login', { 
    email: result.user.email,
    userId: result.user.id
  });
});
```

## 🔐 Advanced Security Features

### IP-Based Restrictions (Custom Implementation)

```javascript
auth.on('beforeLogin', async ({ email, req }) => {
  const ip = req.ip;
  
  // Check if IP is blacklisted
  if (await isBlacklisted(ip)) {
    throw new Error('Access denied from this IP');
  }
  
  // Track login attempts by IP
  await trackIPAttempt(ip, email);
});
```

### Geolocation Tracking (Custom Implementation)

```javascript
auth.on('afterLogin', async (result) => {
  const location = await getLocationFromIP(req.ip);
  
  // Detect suspicious logins
  if (location.country !== result.user.lastLoginCountry) {
    await sendSecurityAlert(result.user.email, location);
  }
});
```

### Device Fingerprinting (Custom Implementation)

```javascript
auth.on('afterLogin', async (result) => {
  const fingerprint = generateFingerprint(req);
  
  // Recognize trusted devices
  const isTrustedDevice = await checkDeviceTrust(
    result.user.id, 
    fingerprint
  );
  
  if (!isTrustedDevice) {
    await sendNewDeviceAlert(result.user.email);
  }
});
```

## 📊 Security Audit Logging

```javascript
// Comprehensive audit logging
const auditLogger = {
  register: (user) => log('REGISTER', user),
  login: (user) => log('LOGIN', user),
  logout: (user) => log('LOGOUT', user),
  passwordChange: (user) => log('PASSWORD_CHANGE', user),
  failedLogin: (email) => log('FAILED_LOGIN', { email })
};

auth.on('afterRegister', (result) => auditLogger.register(result.user));
auth.on('afterLogin', (result) => auditLogger.login(result.user));
auth.on('beforeLogin', ({ email }) => {
  // Log failed attempts in catch block
});
```

## 🔍 Vulnerability Disclosure

If you discover a security vulnerability, please open an issue.

**Do not** open a public issue for security vulnerabilities.

---

**Remember: Security is a continuous process, not a one-time setup!**
