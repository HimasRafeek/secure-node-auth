# Email Verification & Password Reset with 6-Digit Codes Guide

## 6-Digit Codes (New Feature!)

### Overview

You can now use **6-digit numeric codes** as an alternative to URL-based methods for both:
- ✅ **Email Verification** - Verify new user accounts
- ✅ **Password Reset** - Secure password recovery

This is perfect for mobile apps or when you want a simpler, more modern user experience.

### Quick Start

#### 1. Send Verification Code

```javascript
const auth = new SecureNodeAuth({
  /* config */
});
await auth.init();

// Send 6-digit code to user's email
await auth.sendVerificationCode('user@example.com');

// User receives email with code like: 123456
```

#### 2. Verify Code

```javascript
// User enters the code in your app
const result = await auth.verifyCode('user@example.com', '123456');

console.log(result);
// { success: true, userId: 1, message: 'Email verified successfully' }
```

### Configuration Options

```javascript
// Custom expiration time (default: 10 minutes)
await auth.sendVerificationCode('user@example.com', {
  expiresInMinutes: 5,
});
```

### Custom Email Template

```javascript
const auth = new SecureNodeAuth({
  emailTemplates: {
    verificationCode: {
      subject: 'Your Verification Code',
      html: (code, email, expiresInMinutes) => `
        <h2>Your Code: ${code}</h2>
        <p>Expires in ${expiresInMinutes} minutes</p>
      `,
    },
  },
});
```

### Express.js Example

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Send code endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    await auth.register({ email, password });
    await auth.sendVerificationCode(email);

    res.json({
      success: true,
      message: 'Check your email for verification code',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify code endpoint
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;

    await auth.verifyCode(email, code);

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## 6-Digit Password Reset Codes (New Feature!)

### Overview

Just like email verification, you can now use **6-digit codes for password reset** instead of URL-based password reset links.

### Quick Start

#### 1. Send Password Reset Code

```javascript
// Send 6-digit reset code
await auth.sendPasswordResetCode('user@example.com');

// User receives email with code like: 987654
```

#### 2. Reset Password with Code

```javascript
// User enters code and new password
const result = await auth.resetPasswordWithCode(
  'user@example.com',
  '987654',
  'NewSecurePass123!'
);

console.log(result);
// { success: true, message: 'Password reset successfully' }
```

### Configuration Options

```javascript
// Custom expiration time (default: 15 minutes)
await auth.sendPasswordResetCode('user@example.com', {
  expiresInMinutes: 10,
});
```

### Express.js Example - Password Reset with Code

```javascript
const express = require('express');
const app = express();
app.use(express.json());

// Send password reset code
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    await auth.sendPasswordResetCode(email, {
      expiresInMinutes: 15,
    });

    res.json({
      success: true,
      message: 'If the email exists, a reset code has been sent.',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset password with code
app.post('/api/auth/reset-password-code', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    await auth.resetPasswordWithCode(email, code, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in.',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Custom Email Template for Password Reset Code

```javascript
const auth = new SecureNodeAuth({
  emailTemplates: {
    passwordResetCode: {
      subject: 'Your Password Reset Code - MyApp',
      html: (code, email, expiresInMinutes) => `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Your password reset code is:</p>
          <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f0f0f0; text-align: center;">
            ${code}
          </div>
          <p>This code expires in ${expiresInMinutes} minutes.</p>
          <p>If you didn't request this, ignore this email.</p>
        </body>
        </html>
      `,
    },
  },
});
```

---

## Comparison: URL vs Code Methods

### Email Verification

| Feature          | URL Verification                            | 6-Digit Code                              |
| ---------------- | ------------------------------------------- | ----------------------------------------- |
| **Expiration**   | 24 hours                                    | 10 minutes (customizable)                 |
| **User Action**  | Click link in email                         | Enter code in app                         |
| **Best For**     | Web apps                                    | Mobile apps, better UX                    |
| **Security**     | Long random token                           | Short numeric code                        |
| **Token Length** | 64 characters                               | 6 digits                                  |
| **Method**       | `sendVerificationEmail()` + `verifyEmail()` | `sendVerificationCode()` + `verifyCode()` |

### Password Reset

| Feature          | URL Reset                                          | 6-Digit Code                                               |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| **Expiration**   | 1 hour                                             | 15 minutes (customizable)                                  |
| **User Action**  | Click link in email                                | Enter code + new password in app                           |
| **Best For**     | Web apps                                           | Mobile apps, better UX                                     |
| **Security**     | Long random token                                  | Short numeric code                                         |
| **Token Length** | 64 characters                                      | 6 digits                                                   |
| **Method**       | `sendPasswordResetEmail()` + `resetPassword()`     | `sendPasswordResetCode()` + `resetPasswordWithCode()`      |

### Security Features (Both Methods)

- **Automatic cleanup**: Old codes are deleted when sending new ones
- **Expiration**: Codes expire quickly (10-15 minutes, customizable)
- **Format validation**: Only accepts exactly 6 digits
- **Rate limiting**: Prevent brute force attacks (implement Express rate limiting)
- **Single use**: Codes are deleted after successful use
- **Force re-login**: All sessions revoked after password reset

### Error Handling

```javascript
try {
  await auth.verifyCode('user@example.com', '123456');
} catch (error) {
  switch (error.message) {
    case 'Invalid or expired verification code':
      // Code wrong or expired
      break;
    case 'Code must be exactly 6 digits':
      // Format error
      break;
    case 'User not found':
      // Email doesn't exist
      break;
    case 'Email is already verified':
      // Already verified
      break;
  }
}
```

---

## Audit Logger

### What is the Audit Logger?

The audit logger is an **optional feature** that logs security-related events in your application. It's useful for:

- Security audits
- Compliance requirements (GDPR, HIPAA, etc.)
- Debugging authentication issues
- Monitoring suspicious activity
- Tracking user actions

### Default Behavior

By default, audit events are logged to **console only**:

```javascript
const auth = new SecureNodeAuth({
  /* config */
});

// Default: Logs to console
// [AUDIT 2025-11-20T10:30:00.000Z] USER_LOGIN: {"userId":1,"email":"user@example.com","success":true}
```

### Events Logged

The following security events are automatically logged:

| Event             | Description              | Data Logged                    |
| ----------------- | ------------------------ | ------------------------------ |
| `USER_REGISTERED` | New user created         | userId, email, success         |
| `USER_LOGIN`      | User logged in           | userId, email, success, ip     |
| `USER_LOGOUT`     | User logged out          | userId, success                |
| `TOKEN_REFRESH`   | Access token refreshed   | userId, email, success         |
| `PASSWORD_CHANGE` | Password changed         | userId, email, success         |
| `PASSWORD_RESET`  | Password reset via email | userId, email, success         |
| `EMAIL_VERIFIED`  | Email verified           | userId, email, success, method |

### Custom Audit Logger (Recommended for Production)

**Option 1: Log to File**

```javascript
const fs = require('fs');
const path = require('path');

const auth = new SecureNodeAuth({
  auditLogger: (event, data) => {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, event, ...data }) + '\n';

    fs.appendFileSync(path.join(__dirname, 'audit.log'), logEntry);
  },
});
```

**Option 2: Log to Database**

```javascript
const auth = new SecureNodeAuth({
  auditLogger: async (event, data) => {
    await db.query(
      'INSERT INTO audit_logs (event, userId, email, success, ip, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [event, data.userId, data.email, data.success, data.ip, new Date()]
    );
  },
});
```

**Option 3: Send to Monitoring Service**

```javascript
const { Sentry } = require('@sentry/node');

const auth = new SecureNodeAuth({
  auditLogger: (event, data) => {
    // Log to Sentry, Datadog, New Relic, etc.
    Sentry.captureMessage(event, {
      level: 'info',
      extra: data,
    });
  },
});
```

**Option 4: Winston Logger**

```javascript
const winston = require('winston');

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'audit.log' }),
    new winston.transports.Console(),
  ],
});

const auth = new SecureNodeAuth({
  auditLogger: (event, data) => {
    auditLogger.info(event, data);
  },
});
```

### Disable Audit Logging

```javascript
// Completely disable audit logging
const auth = new SecureNodeAuth({
  auditLogger: () => {}, // No-op function
});
```

### Best Practices

1. **Production**: Always log to a persistent storage (file, database, or monitoring service)
2. **Log Rotation**: Use tools like `winston-daily-rotate-file` to prevent log files from growing too large
3. **PII Compliance**: Be careful logging sensitive data (passwords are never logged)
4. **Retention**: Set retention policies for audit logs (e.g., keep for 90 days)
5. **Monitoring**: Set up alerts for suspicious events (multiple failed logins, etc.)

### Example: Advanced Audit System

```javascript
const winston = require('winston');
require('winston-daily-rotate-file');

// Create rotating file transport
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'audit-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '90d', // Keep 90 days
  dirname: './logs',
});

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    fileRotateTransport,
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const auth = new SecureNodeAuth({
  auditLogger: (event, data) => {
    // Add request IP if available
    const logData = {
      event,
      ...data,
      timestamp: new Date().toISOString(),
    };

    // Log to Winston
    auditLogger.info(logData);

    // Alert on suspicious events
    if (event === 'USER_LOGIN' && !data.success) {
      // Track failed login attempts
      checkForBruteForce(data.email);
    }

    if (event === 'PASSWORD_CHANGE') {
      // Send notification to user
      sendSecurityNotification(data.email, 'Password changed');
    }
  },
});

function checkForBruteForce(email) {
  // Implement rate limiting or alerting
  console.warn(`⚠️ Failed login for: ${email}`);
}

function sendSecurityNotification(email, message) {
  // Send email/SMS notification
  console.log(`🔒 Security alert sent to: ${email} - ${message}`);
}
```

### Summary

- **Audit Logger**: Optional, defaults to console, fully customizable
- **What to Log**: Security events (login, register, password changes, etc.)
- **How to Use**: Pass custom `auditLogger` function in config
- **Best For**: Production monitoring, compliance, security audits
- **Privacy**: Never logs passwords or sensitive data

---

## Full Example: Both Features Together

```javascript
const SecureNodeAuth = require('secure-node-auth');
const winston = require('winston');

// Set up audit logger
const auditLogger = winston.createLogger({
  transports: [new winston.transports.File({ filename: 'audit.log' })],
});

const auth = new SecureNodeAuth({
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'myapp',
  },
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'noreply@myapp.com',
      pass: 'app-password',
    },
  },
  // Custom audit logger
  auditLogger: (event, data) => {
    auditLogger.info({ event, ...data });
  },
  // Custom email template for 6-digit codes
  emailTemplates: {
    verificationCode: {
      subject: 'Your MyApp Verification Code',
      html: (code, email, minutes) => `
        <h2>Welcome to MyApp!</h2>
        <p>Your verification code is:</p>
        <h1 style="font-size: 48px; letter-spacing: 10px;">${code}</h1>
        <p>Expires in ${minutes} minutes</p>
      `,
    },
  },
});

// Usage
await auth.init();

// Register user
const { user } = await auth.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
});

// Send 6-digit verification code
await auth.sendVerificationCode(user.email, {
  expiresInMinutes: 5,
});

// Verify code (user enters code from email)
await auth.verifyCode(user.email, '123456');

// All events are logged via custom audit logger
```

---

## Need Help?

- **Examples**: See `examples/email-verification-examples.js`
- **API Docs**: See `docs/API_REFERENCE.md`
- **GitHub**: https://github.com/HimasRafeek/secure-node-auth
- **npm**: https://www.npmjs.com/package/secure-node-auth
