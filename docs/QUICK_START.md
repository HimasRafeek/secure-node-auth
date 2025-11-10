# Quick Start Guide - Secure Node Auth

## 📦 Installation

```bash
npm install secure-node-auth
```

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies

```bash
npm install secure-node-auth express dotenv
```

### Step 2: Create `.env` file

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=myapp
JWT_ACCESS_SECRET=change_this_in_production
JWT_REFRESH_SECRET=change_this_in_production
```

### Step 3: Create `server.js`

```javascript
require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

const auth = new SecureNodeAuth();

auth.init().then(() => {
  app.use('/auth', auth.router());
  
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
});
```

### Step 4: Run

```bash
node server.js
```

## 🎯 Test Your API

### Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "John"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

You'll get back:
```json
{
  "success": true,
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

### Access Protected Route

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 🚀 Next Steps

1. **Add Custom Fields**: Extend user schema with your own fields
2. **Add Hooks**: Implement custom logic (send emails, analytics, etc.)
3. **Customize Security**: Adjust password requirements, lockout times, etc.
4. **Add Protected Routes**: Use `auth.middleware()` to protect your APIs

## 📚 Common Use Cases

### Protect Your API Routes

```javascript
app.get('/api/profile', auth.middleware(), (req, res) => {
  // req.user contains { userId, email, iat, exp }
  res.json({ userId: req.user.userId });
});
```

### Add Custom Fields

```javascript
const auth = new SecureNodeAuth();

auth.addField({ name: 'phoneNumber', type: 'VARCHAR(20)' });
auth.addField({ name: 'companyName', type: 'VARCHAR(255)' });

await auth.init();
```

### Send Welcome Email

```javascript
auth.on('afterRegister', async (result) => {
  await sendEmail({
    to: result.user.email,
    subject: 'Welcome!',
    body: `Welcome ${result.user.firstName}!`
  });
});
```

## ⚙️ Configuration

All options are optional with sensible defaults:

```javascript
const auth = new SecureNodeAuth({
  connection: { /* MySQL config */ },
  jwt: { 
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d'
  },
  security: {
    bcryptRounds: 10,
    maxLoginAttempts: 5,
    passwordMinLength: 8
  }
});
```

## 🔒 Security Best Practices

1. ✅ Use environment variables for secrets
2. ✅ Use HTTPS in production
3. ✅ Store tokens securely (httpOnly cookies recommended)
4. ✅ Implement CORS properly
5. ✅ Add rate limiting on public endpoints
6. ✅ Keep dependencies updated

## 🆘 Troubleshooting

**Database Connection Failed**
- Check MySQL is running
- Verify credentials in `.env`
- Ensure database exists

**"Cannot add fields after initialization"**
- Call `addField()` BEFORE `init()`

**Token Expired**
- Use refresh token to get new access token
- POST to `/auth/refresh` with `refreshToken`

## 📖 Full Documentation

See [README.md](../README.md) for complete documentation.

## 💡 Tips

- Access tokens expire quickly (15m) - use refresh tokens
- Refresh tokens expire after 7 days - user needs to login again
- Use hooks for custom business logic
- Custom fields are automatically added to registration/profile
- All passwords are automatically hashed with bcrypt

---

**That's it! You now have a production-ready authentication system! 🎉**
