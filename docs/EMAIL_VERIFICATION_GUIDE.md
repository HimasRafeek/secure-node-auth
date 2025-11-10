# Email Verification & Password Reset Guide

Complete guide for setting up SMTP email features in SecureNodeAuth, including email verification and password reset functionality.

---

## 📧 Features

✅ **Email Verification**
- Send verification emails on registration
- Verify email with secure tokens
- Resend verification emails
- 24-hour token expiration

✅ **Password Reset**
- Forgot password flow
- Secure reset tokens (1-hour expiration)
- Email-based password recovery
- Automatic token cleanup

✅ **Custom Email Templates**
- Beautiful HTML email templates
- Customizable branding
- Responsive design

✅ **SMTP Configuration**
- Support for any SMTP provider
- Gmail, SendGrid, Mailgun, AWS SES, etc.
- TLS/SSL support

---

## 🚀 Quick Setup

### 1. Install Package

Already included in SecureNodeAuth! The `nodemailer` dependency is pre-installed.

### 2. Configure SMTP in Environment Variables

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database

# JWT Secrets
JWT_ACCESS_SECRET=your-32-char-access-secret-here
JWT_REFRESH_SECRET=your-32-char-refresh-secret-here

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourapp.com

# Frontend URLs
VERIFICATION_URL=http://localhost:3000/verify-email
PASSWORD_RESET_URL=http://localhost:3000/reset-password
```

### 3. Initialize SecureNodeAuth with Email Support

```javascript
const SecureNodeAuth = require('secure-node-auth');

const auth = new SecureNodeAuth({
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET
  },
  security: {
    requireEmailVerification: false, // Set to true to enforce verification
    bcryptRounds: 10
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: process.env.SMTP_FROM
  },
  verificationUrl: process.env.VERIFICATION_URL,
  passwordResetUrl: process.env.PASSWORD_RESET_URL
});

await auth.init();
```

---

## 📨 SMTP Provider Configuration

### Gmail

1. **Enable 2-Factor Authentication** in your Google Account
2. **Generate App Password**: 
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Create app password for "Mail"
   - Use this as `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
```

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=verified-sender@yourdomain.com
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
```

### AWS SES

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

### Outlook/Office 365

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Development (Mailtrap)

Perfect for testing without sending real emails:

```env
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
```

---

## 💻 Usage Examples

### 1. Email Verification Flow

#### Backend: Send Verification on Registration

**Automatic (Recommended)**
```javascript
const auth = new SecureNodeAuth({
  // ... other config
  security: {
    requireEmailVerification: true // Auto-send on registration
  },
  verificationUrl: 'http://localhost:3000/verify-email'
});

// When user registers, email is automatically sent
app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await auth.register(req.body);
    res.json({
      success: true,
      message: 'Registration successful! Check your email for verification.',
      data: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

**Manual**
```javascript
app.post('/api/auth/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    await auth.sendVerificationEmail(
      email, 
      'http://localhost:3000/verify-email'
    );
    res.json({ message: 'Verification email sent!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### Backend: Verify Email

```javascript
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    const result = await auth.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email verified successfully!',
      userId: result.userId
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### Frontend: Verification Page

```javascript
// React component for email verification
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    // Verify email
    axios.post('/api/auth/verify-email', { token })
      .then(response => {
        setStatus('success');
        setMessage('Email verified! Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      })
      .catch(error => {
        setStatus('error');
        setMessage(error.response?.data?.error || 'Verification failed');
      });
  }, [searchParams]);

  return (
    <div className="verify-email-page">
      {status === 'verifying' && <p>Verifying your email...</p>}
      {status === 'success' && <p className="success">{message}</p>}
      {status === 'error' && <p className="error">{message}</p>}
    </div>
  );
}
```

#### Resend Verification Email

```javascript
// Backend
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    await auth.resendVerificationEmail(
      email,
      'http://localhost:3000/verify-email'
    );
    res.json({ message: 'Verification email resent!' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Frontend
async function resendVerification(email) {
  try {
    await axios.post('/api/auth/resend-verification', { email });
    alert('Verification email sent! Check your inbox.');
  } catch (error) {
    alert(error.response?.data?.error || 'Failed to resend');
  }
}
```

---

### 2. Password Reset Flow

#### Backend: Forgot Password

```javascript
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await auth.sendPasswordResetEmail(
      email,
      'http://localhost:3000/reset-password'
    );
    
    // Always return success (don't reveal if email exists)
    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent.'
    });
  } catch (error) {
    // Still return success
    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent.'
    });
  }
});
```

#### Backend: Reset Password

```javascript
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const result = await auth.resetPassword(token, newPassword);
    
    res.json({
      success: true,
      message: 'Password reset successfully! Please login.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### Frontend: Forgot Password Form

```javascript
import { useState } from 'react';
import axios from 'axios';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      await axios.post('/api/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (error) {
      setSubmitted(true); // Still show success
    }
  }

  if (submitted) {
    return (
      <div>
        <p>If your email exists, we've sent a password reset link.</p>
        <p>Check your inbox (and spam folder).</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
      />
      <button type="submit">Send Reset Link</button>
    </form>
  );
}
```

#### Frontend: Reset Password Form

```javascript
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    const token = searchParams.get('token');
    
    try {
      await axios.post('/api/auth/reset-password', {
        token,
        newPassword
      });
      
      setMessage('Password reset successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Reset failed');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        placeholder="New password"
        minLength={8}
        required
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        minLength={8}
        required
      />
      <button type="submit">Reset Password</button>
      {message && <p>{message}</p>}
    </form>
  );
}
```

---

## 🎨 Custom Email Templates

Replace the default templates with your own branding:

```javascript
const auth = new SecureNodeAuth({
  // ... other config
  emailTemplates: {
    verification: {
      subject: 'Welcome! Verify Your Email',
      html: (verificationLink, email) => `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 20px;">
          <h1>Welcome to MyApp!</h1>
          <p>Click below to verify your email:</p>
          <a href="${verificationLink}" 
             style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
          <p>Or copy this link: ${verificationLink}</p>
        </body>
        </html>
      `
    },
    passwordReset: {
      subject: 'Reset Your Password',
      html: (resetLink, email) => `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 20px;">
          <h1>Reset Your Password</h1>
          <p>Click below to reset your password:</p>
          <a href="${resetLink}" 
             style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
        </body>
        </html>
      `
    }
  }
});
```

---

## 🔒 Security Best Practices

### 1. Token Expiration
- ✅ Verification tokens: 24 hours
- ✅ Reset tokens: 1 hour
- ✅ Automatic cleanup of expired tokens

### 2. Secure Token Generation
```javascript
// Uses crypto.randomBytes(32) - cryptographically secure
// 64-character hex tokens (2^256 possibilities)
```

### 3. Don't Reveal User Existence
```javascript
// Always return success for forgot password
// Prevents email enumeration attacks
res.json({
  message: 'If the email exists, a reset link has been sent.'
});
```

### 4. HTTPS in Production
```javascript
// Always use HTTPS URLs in production
verificationUrl: 'https://yourapp.com/verify-email'
passwordResetUrl: 'https://yourapp.com/reset-password'
```

### 5. Rate Limiting
```javascript
// Limit email sending to prevent abuse
const rateLimit = require('express-rate-limit');

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 emails per window
  message: 'Too many requests, please try again later'
});

app.post('/api/auth/forgot-password', emailLimiter, async (req, res) => {
  // ...
});
```

---

## 📊 Database Schema

The email verification system uses two database structures:

### 1. Users Table (Updated)
```sql
CREATE TABLE secure_auth_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  emailVerified BOOLEAN DEFAULT FALSE,  -- New field
  resetPasswordToken VARCHAR(255),       -- New field
  resetPasswordExpires BIGINT,           -- New field
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2. Verification Tokens Table (New)
```sql
CREATE TABLE secure_auth_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expiresAt BIGINT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_token (userId, token)
);
```

---

## 🧪 Testing

### Test SMTP Connection

```javascript
async function testEmailConfig() {
  try {
    await auth.emailService.verifyConnection();
    console.log('✓ SMTP connection successful!');
  } catch (error) {
    console.error('✗ SMTP connection failed:', error.message);
  }
}

testEmailConfig();
```

### Send Test Email

```javascript
await auth.sendVerificationEmail(
  'test@example.com',
  'http://localhost:3000/verify-email'
);
console.log('Test email sent!');
```

### Manual Token Verification

```javascript
// Get token from database
const [tokens] = await auth.db.pool.execute(
  'SELECT token FROM secure_auth_verification_tokens WHERE userId = ? LIMIT 1',
  [userId]
);

const token = tokens[0].token;

// Verify
await auth.verifyEmail(token);
console.log('Email verified!');
```

---

## 🚀 Using with Express Routes

SecureNodeAuth provides pre-built routes:

```javascript
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

const auth = new SecureNodeAuth({
  // ... config with SMTP
  verificationUrl: 'http://localhost:3000/verify-email',
  passwordResetUrl: 'http://localhost:3000/reset-password'
});

await auth.init();

// Mount pre-built auth routes (includes email routes)
const AuthRoutes = require('secure-node-auth/src/middleware/AuthRoutes');
const authRoutes = new AuthRoutes(auth, {
  verificationUrl: 'http://localhost:3000/verify-email',
  passwordResetUrl: 'http://localhost:3000/reset-password'
});
app.use('/api/auth', authRoutes.getRouter());

// Available email routes:
// POST /api/auth/send-verification-email
// POST /api/auth/verify-email
// POST /api/auth/resend-verification-email
// POST /api/auth/forgot-password
// POST /api/auth/reset-password

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

---

## 📋 API Endpoints Reference

### Send Verification Email
```
POST /api/auth/send-verification-email
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: { "success": true, "message": "Verification email sent" }
```

### Verify Email
```
POST /api/auth/verify-email
Content-Type: application/json

{
  "token": "64-char-token-from-email"
}

Response: { "success": true, "message": "Email verified successfully" }
```

### Resend Verification
```
POST /api/auth/resend-verification-email
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: { "success": true, "message": "Verification email resent" }
```

### Forgot Password
```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}

Response: { "success": true, "message": "If the email exists, a reset link has been sent." }
```

### Reset Password
```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "64-char-token-from-email",
  "newPassword": "NewSecurePass123!"
}

Response: { "success": true, "message": "Password reset successfully" }
```

---

## 🐛 Troubleshooting

### "Email service not configured"
**Solution**: Check your SMTP environment variables and ensure they're loaded:
```javascript
console.log('SMTP Host:', process.env.SMTP_HOST);
console.log('SMTP User:', process.env.SMTP_USER);
```

### Emails not being received
1. Check spam/junk folder
2. Verify SMTP credentials
3. Test SMTP connection:
```javascript
await auth.emailService.verifyConnection();
```
4. Check provider logs (Gmail, SendGrid, etc.)

### "Invalid or expired token"
- Tokens expire after 24 hours (verification) or 1 hour (reset)
- Request a new verification/reset email
- Check that token wasn't already used

### Gmail "Less secure apps" error
- Enable 2FA on your Google Account
- Generate an App Password (not your regular password)
- Use the 16-character app password

---

## 🌟 Complete Example

See `examples/email-verification-example.js` for a full working example with:
- Email verification on registration
- Resend verification functionality
- Forgot password flow
- Reset password with token
- Custom email templates
- Frontend integration examples

---

## 📚 Related Documentation

- [Main README](../README.md)
- [Security Guide](SECURITY.md)
- [Headless Apps Guide](HEADLESS_APPS_INDEX.md)

---

**Built with ❤️ to make authentication simple and secure!**
