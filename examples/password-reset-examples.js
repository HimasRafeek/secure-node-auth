/**
 * Password Reset Examples
 * Demonstrates both URL-based and 6-digit code reset methods
 */

const SecureNodeAuth = require('../src/index');

const auth = new SecureNodeAuth({
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: 'secure_node_auth',
  },
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password',
    },
  },
});

// ============================================
// Method 1: URL-Based Password Reset (Default)
// ============================================

async function urlBasedPasswordReset() {
  console.log('=== URL-Based Password Reset ===\n');

  try {
    await auth.init();

    // 1. Send password reset email with URL link
    const result = await auth.sendPasswordResetEmail(
      'user@example.com',
      'https://yourapp.com/reset-password'
    );

    console.log('✅ Password reset email sent');
    console.log('   Message:', result.message);

    // 2. User clicks link in email with token parameter
    // URL: https://yourapp.com/reset-password?token=abc123...

    // 3. Your backend resets password with token
    // Note: Token is returned only in email service for testing
    // In production, extract token from URL query parameter

    // const resetResult = await auth.resetPassword(token, 'NewSecurePass123!');
    // console.log('✅ Password reset:', resetResult);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await auth.close();
  }
}

// ============================================
// Method 2: 6-Digit Code Password Reset (New!)
// ============================================

async function codeBasedPasswordReset() {
  console.log('\n=== 6-Digit Code Password Reset ===\n');

  try {
    await auth.init();

    // 1. Send 6-digit reset code
    const result = await auth.sendPasswordResetCode('user@example.com', {
      expiresInMinutes: 15, // Optional: default is 15 minutes
    });

    console.log('✅ Password reset code sent');
    console.log('   Code:', result.code); // For testing only - don't log in production
    console.log('   Expires in: 15 minutes');

    // 2. User receives email with 6-digit code (e.g., 987654)

    // 3. User enters code and new password in your app

    // 4. Your backend resets password with code
    const resetResult = await auth.resetPasswordWithCode(
      'user@example.com',
      result.code,
      'NewSecurePass123!'
    );
    console.log('✅ Password reset:', resetResult);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await auth.close();
  }
}

// ============================================
// Method 3: Express.js Integration - URL Reset
// ============================================

function expressUrlPasswordReset() {
  const express = require('express');
  const app = express();

  app.use(express.json());

  // Send reset email
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      await auth.sendPasswordResetEmail(email, 'https://yourapp.com/reset-password');

      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Token and new password are required',
        });
      }

      await auth.resetPassword(token, newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully. You can now log in.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return app;
}

// ============================================
// Method 4: Express.js Integration - 6-Digit Code
// ============================================

function expressCodePasswordReset() {
  const express = require('express');
  const app = express();

  app.use(express.json());

  // Send reset code
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      await auth.sendPasswordResetCode(email, {
        expiresInMinutes: 15,
      });

      res.json({
        success: true,
        message: 'If the email exists, a reset code has been sent.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Reset password with code
  app.post('/api/auth/reset-password-code', async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Email, code, and new password are required',
        });
      }

      await auth.resetPasswordWithCode(email, code, newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully. You can now log in.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Resend reset code
  app.post('/api/auth/resend-reset-code', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      await auth.sendPasswordResetCode(email, {
        expiresInMinutes: 15,
      });

      res.json({
        success: true,
        message: 'A new reset code has been sent if the email exists.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return app;
}

// ============================================
// Method 5: Custom Email Templates
// ============================================

async function customTemplatePasswordReset() {
  console.log('\n=== Custom Email Template ===\n');

  const customAuth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'your_password',
      database: 'secure_node_auth',
    },
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
    },
    emailTemplates: {
      // Custom template for 6-digit reset code
      passwordResetCode: {
        subject: 'Password Reset Code - MyApp',
        html: (code, email, expiresInMinutes) => `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hi there,</p>
            <p>Someone requested a password reset for your MyApp account. If this was you, use the code below:</p>
            <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f0f0f0; text-align: center; border-radius: 8px; margin: 20px 0;">
              ${code}
            </div>
            <p>This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <hr style="margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">MyApp Security Team</p>
          </body>
          </html>
        `,
      },
      // Custom template for URL reset
      passwordReset: {
        subject: 'Reset Your Password - MyApp',
        html: (resetLink, email) => `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Click the button below to reset your password:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
              Reset Password
            </a>
            <p>Or copy this link: ${resetLink}</p>
            <p>This link expires in 1 hour.</p>
          </body>
          </html>
        `,
      },
    },
  });

  try {
    await customAuth.init();

    // Send with custom template
    await customAuth.sendPasswordResetCode('user@example.com');
    console.log('✅ Custom password reset code sent');

    await customAuth.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// ============================================
// Method 6: Error Handling Best Practices
// ============================================

async function errorHandlingExample() {
  console.log('\n=== Error Handling ===\n');

  try {
    await auth.init();

    // Attempt to reset with invalid code
    try {
      await auth.resetPasswordWithCode('user@example.com', '000000', 'NewPass123!');
    } catch (error) {
      console.log('❌ Invalid code:', error.message);
      // Expected: "Invalid or expired reset code"
    }

    // Attempt to reset with wrong format
    try {
      await auth.resetPasswordWithCode('user@example.com', '12345', 'NewPass123!');
    } catch (error) {
      console.log('❌ Wrong format:', error.message);
      // Expected: "Code must be exactly 6 digits"
    }

    // Attempt with weak password
    try {
      await auth.resetPasswordWithCode('user@example.com', '123456', 'weak');
    } catch (error) {
      console.log('❌ Weak password:', error.message);
      // Expected: Password validation error
    }

    // Attempt with expired code
    try {
      // Code expired after 15 minutes
      await auth.resetPasswordWithCode('user@example.com', '123456', 'NewPass123!');
    } catch (error) {
      console.log('❌ Expired code:', error.message);
      // Expected: "Reset code has expired. Please request a new one."
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await auth.close();
  }
}

// ============================================
// Method 7: Rate Limiting (Recommended)
// ============================================

function rateLimitingExample() {
  const express = require('express');
  const rateLimit = require('express-rate-limit');
  const app = express();

  app.use(express.json());

  // Rate limiter for password reset requests
  const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per window
    message: 'Too many password reset attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiter for code verification attempts
  const verifyCodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many verification attempts. Please request a new code.',
  });

  // Apply rate limiting to reset endpoints
  app.post('/api/auth/forgot-password', resetLimiter, async (req, res) => {
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
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.post('/api/auth/reset-password-code', verifyCodeLimiter, async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;

      await auth.resetPasswordWithCode(email, code, newPassword);

      res.json({
        success: true,
        message: 'Password reset successfully.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  return app;
}

// ============================================
// Method 8: Complete Flow Example
// ============================================

async function completePasswordResetFlow() {
  console.log('\n=== Complete Password Reset Flow ===\n');

  try {
    await auth.init();

    const testEmail = 'testuser@example.com';
    const testPassword = 'OldPassword123!';
    const newPassword = 'NewSecurePass123!';

    console.log('Step 1: Register user');
    await auth.register({
      email: testEmail,
      password: testPassword,
    });
    console.log('✅ User registered\n');

    console.log('Step 2: User forgets password and requests reset code');
    const resetResult = await auth.sendPasswordResetCode(testEmail, {
      expiresInMinutes: 15,
    });
    console.log('✅ Reset code sent:', resetResult.code, '\n');

    console.log('Step 3: User enters code and new password');
    const result = await auth.resetPasswordWithCode(testEmail, resetResult.code, newPassword);
    console.log('✅ Password reset successful:', result.message, '\n');

    console.log('Step 4: User logs in with new password');
    const loginResult = await auth.login(testEmail, newPassword);
    console.log('✅ Login successful with new password\n');
    console.log('User ID:', loginResult.user.id);
    console.log('Tokens received:', Object.keys(loginResult.tokens));
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await auth.close();
  }
}

// ============================================
// Run Examples
// ============================================

(async () => {
  console.log('='.repeat(60));
  console.log('PASSWORD RESET EXAMPLES');
  console.log('='.repeat(60));

  // Choose which example to run:
  // await urlBasedPasswordReset();
  // await codeBasedPasswordReset();
  // await customTemplatePasswordReset();
  // await errorHandlingExample();
  // await completePasswordResetFlow();

  console.log('\n💡 Tips:');
  console.log('   • Use URL reset for web apps');
  console.log('   • Use 6-digit codes for mobile apps or better UX');
  console.log('   • URL tokens expire in 1 hour');
  console.log('   • Codes expire in 15 minutes (customizable)');
  console.log('   • Always implement rate limiting');
  console.log('   • All sessions are revoked after password reset');
})();

module.exports = {
  urlBasedPasswordReset,
  codeBasedPasswordReset,
  expressUrlPasswordReset,
  expressCodePasswordReset,
  customTemplatePasswordReset,
  errorHandlingExample,
  rateLimitingExample,
  completePasswordResetFlow,
};
