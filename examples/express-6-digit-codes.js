/**
 * Express 6-Digit Code Examples
 * Complete examples for email verification and password reset using 6-digit codes
 */

const express = require('express');
const SecureNodeAuth = require('../src/index');
const AuthRoutes = require('../src/middleware/AuthRoutes');

// ==============================================
// EXAMPLE 1: Using Built-in AuthRoutes (Recommended)
// ==============================================

function example1_BuiltInRoutes() {
  const app = express();
  app.use(express.json());

  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'auth_db',
    },
    jwt: {
      accessSecret: 'your-access-secret-key-min-32-chars',
      refreshSecret: 'your-refresh-secret-key-min-32-chars',
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
      from: 'Your App <noreply@yourapp.com>',
    },
  });

  auth.init().then(() => {
    // Use built-in AuthRoutes with all endpoints
    const authRoutes = new AuthRoutes(auth);
    app.use('/auth', authRoutes.getRouter());

    app.listen(3000, () => {
      console.log('✅ Built-in routes available:');
      console.log('   POST /auth/send-verification-code');
      console.log('   POST /auth/verify-code');
      console.log('   POST /auth/send-password-reset-code');
      console.log('   POST /auth/reset-password-with-code');
      console.log('\n🚀 Server running on http://localhost:3000');
    });
  });

  /*
  // Test with curl:
  curl -X POST http://localhost:3000/auth/send-verification-code \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com"}'
  
  curl -X POST http://localhost:3000/auth/verify-code \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","code":"123456"}'
  */
}

// ==============================================
// EXAMPLE 2: Custom Routes with Manual Implementation
// ==============================================

function example2_CustomRoutes() {
  const app = express();
  app.use(express.json());

  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'auth_db',
    },
    jwt: {
      accessSecret: 'your-access-secret-key-min-32-chars',
      refreshSecret: 'your-refresh-secret-key-min-32-chars',
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
    },
  });

  auth.init().then(() => {
    // Custom route: Send verification code
    app.post('/api/send-code', async (req, res) => {
      const { email } = req.body;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Valid email is required',
        });
      }

      try {
        await auth.sendVerificationCode(email);
        res.json({
          success: true,
          message: 'Verification code sent to your email!',
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Custom route: Verify code
    app.post('/api/verify', async (req, res) => {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          error: 'Email and code are required',
        });
      }

      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Code must be exactly 6 digits',
        });
      }

      try {
        const result = await auth.verifyCode(email, code);
        res.json({
          success: true,
          message: 'Email verified successfully!',
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.listen(3001, () => {
      console.log('✅ Custom routes running on port 3001');
    });
  });
}

// ==============================================
// EXAMPLE 3: Password Reset Flow
// ==============================================

function example3_PasswordResetFlow() {
  const app = express();
  app.use(express.json());

  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'auth_db',
    },
    jwt: {
      accessSecret: 'your-access-secret-key-min-32-chars',
      refreshSecret: 'your-refresh-secret-key-min-32-chars',
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
    },
  });

  auth.init().then(() => {
    // Step 1: Request password reset code
    app.post('/password/request-reset', async (req, res) => {
      const { email } = req.body;

      try {
        await auth.sendPasswordResetCode(email, {
          customTemplate: (code) => `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
                .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
                .code { font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 5px; }
              </style>
            </head>
            <body>
              <div class="container">
                <h2>🔒 Password Reset Request</h2>
                <p>Your password reset code is:</p>
                <div class="code">${code}</div>
                <p>This code expires in <strong>15 minutes</strong>.</p>
                <p>If you didn't request this, please ignore this email.</p>
              </div>
            </body>
            </html>
          `,
        });

        // Security best practice: always return success
        res.json({
          success: true,
          message: 'If your email is registered, you will receive a reset code.',
        });
      } catch (error) {
        // Don't reveal if email exists
        res.json({
          success: true,
          message: 'If your email is registered, you will receive a reset code.',
        });
      }
    });

    // Step 2: Reset password with code
    app.post('/password/reset', async (req, res) => {
      const { email, code, newPassword } = req.body;

      // Validation
      if (!email || !code || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Email, code, and new password are required',
        });
      }

      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid code format',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters',
        });
      }

      try {
        const result = await auth.resetPasswordWithCode(email, code, newPassword);
        res.json({
          success: true,
          message: result.message,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.listen(3002, () => {
      console.log('✅ Password reset flow running on port 3002');
    });
  });
}

// ==============================================
// EXAMPLE 4: Complete Registration + Verification Flow
// ==============================================

function example4_CompleteFlow() {
  const app = express();
  app.use(express.json());

  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'auth_db',
    },
    jwt: {
      accessSecret: 'your-access-secret-key-min-32-chars',
      refreshSecret: 'your-refresh-secret-key-min-32-chars',
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
    },
  });

  auth.init().then(() => {
    // Step 1: Register user and automatically send code
    app.post('/register', async (req, res) => {
      const { email, password, firstName, lastName } = req.body;

      try {
        // Register user
        const result = await auth.register({
          email,
          password,
          firstName,
          lastName,
        });

        // Automatically send verification code
        await auth.sendVerificationCode(email);

        res.status(201).json({
          success: true,
          message: 'Registration successful! Check your email for verification code.',
          userId: result.userId,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Step 2: Verify code
    app.post('/verify', async (req, res) => {
      const { email, code } = req.body;

      try {
        const result = await auth.verifyCode(email, code);
        res.json({
          success: true,
          message: 'Email verified! You can now login.',
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Step 3: Login (only works if verified)
    app.post('/login', async (req, res) => {
      const { email, password } = req.body;

      try {
        const result = await auth.login(email, password);
        res.json({
          success: true,
          message: 'Login successful!',
          tokens: result.tokens,
          user: result.user,
        });
      } catch (error) {
        res.status(401).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Protected route example
    app.get('/profile', auth.middleware(), async (req, res) => {
      const user = await auth.getUserById(req.user.userId);
      res.json({
        success: true,
        user,
      });
    });

    app.listen(3003, () => {
      console.log('✅ Complete flow running on port 3003');
      console.log('   1. POST /register - Register and send code');
      console.log('   2. POST /verify - Verify email with code');
      console.log('   3. POST /login - Login after verification');
    });
  });
}

// ==============================================
// EXAMPLE 5: With Rate Limiting
// ==============================================

function example5_WithRateLimiting() {
  const app = express();
  app.use(express.json());

  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'auth_db',
    },
    jwt: {
      accessSecret: 'your-access-secret-key-min-32-chars',
      refreshSecret: 'your-refresh-secret-key-min-32-chars',
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
    },
  });

  auth.init().then(() => {
    // Create rate limiter (max 5 requests per 15 minutes)
    const rateLimiter = auth.security.createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: {
        success: false,
        error: 'Too many requests. Please try again later.',
      },
    });

    // Apply rate limiter to code endpoints
    app.post('/send-code', rateLimiter, async (req, res) => {
      const { email } = req.body;

      try {
        await auth.sendVerificationCode(email);
        res.json({
          success: true,
          message: 'Code sent!',
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.post('/verify-code', rateLimiter, async (req, res) => {
      const { email, code } = req.body;

      try {
        const result = await auth.verifyCode(email, code);
        res.json({
          success: true,
          message: 'Verified!',
          data: result,
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.listen(3004, () => {
      console.log('✅ Rate-limited routes on port 3004 (max 5 per 15 min)');
    });
  });
}

// ==============================================
// EXAMPLE 6: Error Handling Best Practices
// ==============================================

function example6_ErrorHandling() {
  const app = express();
  app.use(express.json());

  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'auth_db',
    },
    jwt: {
      accessSecret: 'your-access-secret-key-min-32-chars',
      refreshSecret: 'your-refresh-secret-key-min-32-chars',
    },
    email: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password',
      },
    },
  });

  auth.init().then(() => {
    // Verify code with comprehensive error handling
    app.post('/verify-code', async (req, res) => {
      const { email, code } = req.body;

      // Input validation
      if (!email || !code) {
        return res.status(400).json({
          success: false,
          error: 'Email and code are required',
          code: 'MISSING_FIELDS',
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format',
          code: 'INVALID_EMAIL',
        });
      }

      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: 'Code must be exactly 6 digits',
          code: 'INVALID_CODE_FORMAT',
        });
      }

      try {
        const result = await auth.verifyCode(email, code);

        res.json({
          success: true,
          message: 'Email verified successfully!',
          data: result,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Map specific errors
        let statusCode = 400;
        let errorCode = 'VERIFICATION_FAILED';

        if (error.message.includes('expired')) {
          errorCode = 'CODE_EXPIRED';
        } else if (error.message.includes('not found')) {
          errorCode = 'CODE_NOT_FOUND';
          statusCode = 404;
        } else if (error.message.includes('invalid')) {
          errorCode = 'INVALID_CODE';
        }

        res.status(statusCode).json({
          success: false,
          error: error.message,
          code: errorCode,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    });

    app.listen(3005, () => {
      console.log('✅ Error handling example on port 3005');
    });
  });
}

// ==============================================
// Run Examples
// ==============================================

function runExamples() {
  console.log('\n🚀 Express 6-Digit Code Examples\n');
  console.log('Choose an example to run:\n');
  console.log('1. Built-in AuthRoutes (recommended)');
  console.log('2. Custom Routes');
  console.log('3. Password Reset Flow');
  console.log('4. Complete Registration + Verification');
  console.log('5. With Rate Limiting');
  console.log('6. Error Handling Best Practices\n');

  const example = process.argv[2] || '1';

  switch (example) {
    case '1':
      example1_BuiltInRoutes();
      break;
    case '2':
      example2_CustomRoutes();
      break;
    case '3':
      example3_PasswordResetFlow();
      break;
    case '4':
      example4_CompleteFlow();
      break;
    case '5':
      example5_WithRateLimiting();
      break;
    case '6':
      example6_ErrorHandling();
      break;
    default:
      console.log('❌ Invalid example number');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runExamples();
}

module.exports = {
  example1_BuiltInRoutes,
  example2_CustomRoutes,
  example3_PasswordResetFlow,
  example4_CompleteFlow,
  example5_WithRateLimiting,
  example6_ErrorHandling,
};
