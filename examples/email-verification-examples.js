/**
 * Email Verification Examples
 * Demonstrates both URL-based and 6-digit code verification methods
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
  security: {
    requireEmailVerification: true,
  },
});

// ============================================
// Method 1: URL-Based Verification (Default)
// ============================================

async function urlBasedVerification() {
  console.log('=== URL-Based Verification ===\n');

  try {
    await auth.init();

    // 1. Send verification email with URL link
    const result = await auth.sendVerificationEmail(
      'user@example.com',
      'https://yourapp.com/verify-email'
    );

    console.log('✅ Verification email sent');
    console.log('   Token:', result.token.substring(0, 20) + '...');

    // 2. User clicks link in email with token parameter
    // URL: https://yourapp.com/verify-email?token=abc123...

    // 3. Your backend verifies the token
    const verifyResult = await auth.verifyEmail(result.token);
    console.log('✅ Email verified:', verifyResult);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await auth.close();
  }
}

// ============================================
// Method 2: 6-Digit Code Verification (New!)
// ============================================

async function codeBasedVerification() {
  console.log('\n=== 6-Digit Code Verification ===\n');

  try {
    await auth.init();

    // 1. Send 6-digit verification code
    const result = await auth.sendVerificationCode('user@example.com', {
      expiresInMinutes: 10, // Optional: default is 10 minutes
    });

    console.log('✅ Verification code sent');
    console.log('   Code:', result.code); // For testing only - don't log in production
    console.log('   Expires in: 10 minutes');

    // 2. User receives email with 6-digit code (e.g., 123456)

    // 3. User enters code in your app's form

    // 4. Your backend verifies the code
    const verifyResult = await auth.verifyCode('user@example.com', result.code);
    console.log('✅ Email verified:', verifyResult);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await auth.close();
  }
}

// ============================================
// Method 3: Express.js Integration - URL Verification
// ============================================

function expressUrlVerification() {
  const express = require('express');
  const app = express();

  app.use(express.json());

  // Registration endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Register user
      const result = await auth.register({ email, password, firstName, lastName });

      // Send verification email
      await auth.sendVerificationEmail(email, 'https://yourapp.com/verify-email');

      res.json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        user: result.user,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Email verification endpoint
  app.get('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required' });
      }

      const result = await auth.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
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

function expressCodeVerification() {
  const express = require('express');
  const app = express();

  app.use(express.json());

  // Registration endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Register user
      const result = await auth.register({ email, password, firstName, lastName });

      // Send 6-digit verification code
      await auth.sendVerificationCode(email, {
        expiresInMinutes: 10,
      });

      res.json({
        success: true,
        message: 'Registration successful. Please check your email for a verification code.',
        user: result.user,
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Code verification endpoint
  app.post('/api/auth/verify-code', async (req, res) => {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ success: false, error: 'Email and code are required' });
      }

      const result = await auth.verifyCode(email, code);

      res.json({
        success: true,
        message: 'Email verified successfully. You can now log in.',
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // Resend code endpoint
  app.post('/api/auth/resend-code', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      await auth.sendVerificationCode(email, {
        expiresInMinutes: 10,
      });

      res.json({
        success: true,
        message: 'A new verification code has been sent to your email.',
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

async function customTemplateVerification() {
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
      // Custom template for 6-digit code
      verificationCode: {
        subject: 'Your Verification Code - MyApp',
        html: (code, email, expiresInMinutes) => `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2>Welcome to MyApp!</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f0f0f0; text-align: center;">
              ${code}
            </div>
            <p>This code expires in ${expiresInMinutes} minutes.</p>
            <p>If you didn't sign up for MyApp, ignore this email.</p>
          </body>
          </html>
        `,
      },
      // Custom template for URL verification
      verification: {
        subject: 'Verify Your Email - MyApp',
        html: (verificationLink, email) => `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2>Welcome to MyApp!</h2>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
              Verify Email
            </a>
            <p>Or copy this link: ${verificationLink}</p>
          </body>
          </html>
        `,
      },
    },
  });

  try {
    await customAuth.init();

    // Send with custom template
    await customAuth.sendVerificationCode('user@example.com');
    console.log('✅ Custom verification code sent');

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

    // Attempt to verify with invalid code
    try {
      await auth.verifyCode('user@example.com', '000000');
    } catch (error) {
      console.log('❌ Invalid code:', error.message);
      // Expected: "Invalid or expired verification code"
    }

    // Attempt to verify with wrong format
    try {
      await auth.verifyCode('user@example.com', '12345'); // Only 5 digits
    } catch (error) {
      console.log('❌ Wrong format:', error.message);
      // Expected: "Code must be exactly 6 digits"
    }

    // Attempt to send code to non-existent user
    try {
      await auth.sendVerificationCode('nonexistent@example.com');
    } catch (error) {
      console.log('❌ User not found:', error.message);
      // Expected: "User not found"
    }

    // Attempt to verify already verified email
    try {
      await auth.sendVerificationCode('verified@example.com');
    } catch (error) {
      console.log('❌ Already verified:', error.message);
      // Expected: "Email is already verified"
    }
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
  console.log('EMAIL VERIFICATION EXAMPLES');
  console.log('='.repeat(60));

  // Choose which example to run:
  // await urlBasedVerification();
  // await codeBasedVerification();
  // await customTemplateVerification();
  // await errorHandlingExample();

  console.log('\n💡 Tips:');
  console.log('   • Use URL verification for web apps');
  console.log('   • Use 6-digit codes for mobile apps or better UX');
  console.log('   • Both methods use the same database table');
  console.log('   • Codes expire in 10 minutes (customizable)');
  console.log('   • URL tokens expire in 24 hours');
})();

module.exports = {
  urlBasedVerification,
  codeBasedVerification,
  expressUrlVerification,
  expressCodeVerification,
  customTemplateVerification,
  errorHandlingExample,
};
