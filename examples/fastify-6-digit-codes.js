/**
 * Fastify 6-Digit Code Examples
 * Complete examples for email verification and password reset using 6-digit codes
 */

const fastify = require('fastify')({ logger: true });
const SecureNodeAuth = require('../src/index');
const secureNodeAuthPlugin = require('../src/middleware/FastifyPlugin');

// Configuration
const auth = new SecureNodeAuth({
  connection: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'auth_db'
  },
  jwt: {
    accessSecret: 'your-access-secret-key-min-32-chars',
    refreshSecret: 'your-refresh-secret-key-min-32-chars'
  },
  email: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password'
    },
    from: 'Your App <noreply@yourapp.com>'
  }
});

// ==============================================
// EXAMPLE 1: Using Built-in Routes (Automatic)
// ==============================================

async function example1_BuiltInRoutes() {
  const app = fastify({ logger: false });
  
  await auth.init();
  
  // Register plugin with all routes (includes 6-digit code routes)
  await app.register(secureNodeAuthPlugin, {
    authInstance: auth,
    routeOptions: {
      prefix: '/auth'
    }
  });
  
  await app.listen({ port: 3000 });
  console.log('✅ Built-in routes available:');
  console.log('   POST /auth/send-verification-code');
  console.log('   POST /auth/verify-code');
  console.log('   POST /auth/send-password-reset-code');
  console.log('   POST /auth/reset-password-with-code');
  
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
// EXAMPLE 2: Custom Routes with Validation
// ==============================================

async function example2_CustomRoutes() {
  const app = fastify({ logger: false });
  
  await auth.init();
  
  // Custom verification code route with rate limiting
  app.post('/custom/send-code', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { email } = request.body;
    
    try {
      await auth.sendVerificationCode(email);
      return { success: true, message: 'Verification code sent!' };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });
  
  // Custom verify code route
  app.post('/custom/verify', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{6}$' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, code } = request.body;
    
    try {
      const result = await auth.verifyCode(email, code);
      return {
        success: true,
        message: 'Email verified successfully!',
        data: result
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });
  
  await app.listen({ port: 3001 });
  console.log('✅ Custom routes running on port 3001');
}

// ==============================================
// EXAMPLE 3: Password Reset Flow
// ==============================================

async function example3_PasswordResetFlow() {
  const app = fastify({ logger: false });
  
  await auth.init();
  
  // Step 1: Request reset code
  app.post('/password/request-reset', async (request, reply) => {
    const { email } = request.body;
    
    try {
      await auth.sendPasswordResetCode(email, {
        customTemplate: (code) => `
          <h1>Password Reset</h1>
          <p>Your reset code is: <strong>${code}</strong></p>
          <p>This code expires in 15 minutes.</p>
        `
      });
      
      // Always return success (security best practice)
      return {
        success: true,
        message: 'If the email exists, a reset code has been sent.'
      };
    } catch (error) {
      return {
        success: true,
        message: 'If the email exists, a reset code has been sent.'
      };
    }
  });
  
  // Step 2: Reset with code
  app.post('/password/reset', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'code', 'newPassword'],
        properties: {
          email: { type: 'string', format: 'email' },
          code: { type: 'string', pattern: '^\\d{6}$' },
          newPassword: { type: 'string', minLength: 8 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, code, newPassword } = request.body;
    
    try {
      const result = await auth.resetPasswordWithCode(email, code, newPassword);
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });
  
  await app.listen({ port: 3002 });
  console.log('✅ Password reset flow running on port 3002');
}

// ==============================================
// EXAMPLE 4: Complete Registration + Verification
// ==============================================

async function example4_CompleteFlow() {
  const app = fastify({ logger: false });
  
  await auth.init();
  
  // Step 1: Register user
  app.post('/register', async (request, reply) => {
    const { email, password, firstName, lastName } = request.body;
    
    try {
      const result = await auth.register({ email, password, firstName, lastName });
      
      // Automatically send verification code
      await auth.sendVerificationCode(email);
      
      return {
        success: true,
        message: 'Registration successful! Check email for verification code.',
        userId: result.userId
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });
  
  // Step 2: Verify and login
  app.post('/verify-and-login', async (request, reply) => {
    const { email, code, password } = request.body;
    
    try {
      // First verify the code
      await auth.verifyCode(email, code);
      
      // Then login automatically
      const loginResult = await auth.login(email, password);
      
      return {
        success: true,
        message: 'Email verified and logged in!',
        tokens: loginResult.tokens
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });
  
  await app.listen({ port: 3003 });
  console.log('✅ Complete registration flow on port 3003');
}

// ==============================================
// EXAMPLE 5: With Rate Limiting
// ==============================================

async function example5_WithRateLimiting() {
  const app = fastify({ logger: false });
  
  await auth.init();
  
  // Register rate limiting
  await app.register(require('@fastify/rate-limit'), {
    max: 5, // 5 requests
    timeWindow: '15 minutes'
  });
  
  app.post('/send-code', async (request, reply) => {
    const { email } = request.body;
    
    try {
      await auth.sendVerificationCode(email);
      return { success: true, message: 'Code sent!' };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });
  
  await app.listen({ port: 3004 });
  console.log('✅ Rate-limited routes on port 3004 (max 5 requests per 15 min)');
}

// ==============================================
// EXAMPLE 6: Error Handling Best Practices
// ==============================================

async function example6_ErrorHandling() {
  const app = fastify({ logger: false });
  
  await auth.init();
  
  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    
    reply.code(statusCode).send({
      success: false,
      error: error.message,
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  });
  
  app.post('/verify-code', async (request, reply) => {
    const { email, code } = request.body;
    
    // Input validation
    if (!email || !code) {
      return reply.code(400).send({
        success: false,
        error: 'Email and code are required'
      });
    }
    
    if (!/^\d{6}$/.test(code)) {
      return reply.code(400).send({
        success: false,
        error: 'Code must be 6 digits'
      });
    }
    
    try {
      const result = await auth.verifyCode(email, code);
      return { success: true, data: result };
    } catch (error) {
      throw error; // Handled by global error handler
    }
  });
  
  await app.listen({ port: 3005 });
  console.log('✅ Error handling example on port 3005');
}

// ==============================================
// Run Examples
// ==============================================

async function runExamples() {
  console.log('\n🚀 Fastify 6-Digit Code Examples\n');
  console.log('Choose an example to run:\n');
  console.log('1. Built-in Routes (recommended)');
  console.log('2. Custom Routes with Validation');
  console.log('3. Password Reset Flow');
  console.log('4. Complete Registration + Verification');
  console.log('5. With Rate Limiting');
  console.log('6. Error Handling Best Practices\n');
  
  const example = process.argv[2] || '1';
  
  switch(example) {
    case '1':
      await example1_BuiltInRoutes();
      break;
    case '2':
      await example2_CustomRoutes();
      break;
    case '3':
      await example3_PasswordResetFlow();
      break;
    case '4':
      await example4_CompleteFlow();
      break;
    case '5':
      await example5_WithRateLimiting();
      break;
    case '6':
      await example6_ErrorHandling();
      break;
    default:
      console.log('❌ Invalid example number');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  example1_BuiltInRoutes,
  example2_CustomRoutes,
  example3_PasswordResetFlow,
  example4_CompleteFlow,
  example5_WithRateLimiting,
  example6_ErrorHandling
};
