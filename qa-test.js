/**
 * QA Test Suite for SecureNodeAuth
 * Tests core functionality, email features, Express routes, and Fastify routes
 */

const SecureNodeAuth = require('./src/index');

// Color console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    log(`✓ ${testName}`, 'green');
    testsPassed++;
  } else {
    log(`✗ ${testName}`, 'red');
    testsFailed++;
  }
}

async function runTests() {
  log('\n════════════════════════════════════════', 'blue');
  log('  SecureNodeAuth QA Test Suite', 'blue');
  log('════════════════════════════════════════\n', 'blue');

  // Test 1: Basic Initialization
  log('1. Testing Basic Initialization...', 'yellow');
  try {
    const auth = new SecureNodeAuth({
      connection: {
        host: 'localhost',
        user: 'test',
        password: 'test',
        database: 'test'
      },
      jwt: {
        accessSecret: 'test-secret-min-32-chars-long-abc',
        refreshSecret: 'test-refresh-min-32-chars-long-xyz'
      }
    });

    assert(auth !== null, 'Auth instance created');
    assert(auth.db !== undefined, 'Database manager exists');
    assert(auth.tokenService !== undefined, 'Token service exists');
    assert(auth.security !== undefined, 'Security service exists');
    assert(auth.emailService === null, 'Email service not initialized yet');
    assert(typeof auth.register === 'function', 'register() method exists');
    assert(typeof auth.login === 'function', 'login() method exists');
    assert(typeof auth.logout === 'function', 'logout() method exists');
    assert(typeof auth.logoutAll === 'function', 'logoutAll() method exists');
    assert(typeof auth.refreshToken === 'function', 'refreshToken() method exists');
  } catch (error) {
    log(`✗ Initialization failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 2: Email Service Configuration
  log('\n2. Testing Email Service Configuration...', 'yellow');
  try {
    const authWithEmail = new SecureNodeAuth({
      connection: {
        host: 'localhost',
        user: 'test',
        password: 'test',
        database: 'test'
      },
      jwt: {
        accessSecret: 'test-secret-min-32-chars-long-abc',
        refreshSecret: 'test-refresh-min-32-chars-long-xyz'
      },
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        auth: {
          user: 'test@example.com',
          pass: 'password'
        }
      }
    });

    assert(authWithEmail.options.smtp.host === 'smtp.example.com', 'SMTP host configured');
    assert(authWithEmail.options.smtp.port === 587, 'SMTP port configured');
    assert(typeof authWithEmail.sendVerificationEmail === 'function', 'sendVerificationEmail() exists');
    assert(typeof authWithEmail.verifyEmail === 'function', 'verifyEmail() exists');
    assert(typeof authWithEmail.resendVerificationEmail === 'function', 'resendVerificationEmail() exists');
    assert(typeof authWithEmail.sendPasswordResetEmail === 'function', 'sendPasswordResetEmail() exists');
    assert(typeof authWithEmail.resetPassword === 'function', 'resetPassword() exists');
    assert(typeof authWithEmail.isEmailVerified === 'function', 'isEmailVerified() exists');
  } catch (error) {
    log(`✗ Email config failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 3: Custom Fields
  log('\n3. Testing Custom Fields...', 'yellow');
  try {
    const authWithFields = new SecureNodeAuth({
      connection: {
        host: 'localhost',
        user: 'test',
        password: 'test',
        database: 'test'
      },
      jwt: {
        accessSecret: 'test-secret-min-32-chars-long-abc',
        refreshSecret: 'test-refresh-min-32-chars-long-xyz'
      }
    });

    authWithFields.addField({
      name: 'age',
      type: 'INT',
      required: false
    });

    authWithFields.addField({
      name: 'phoneNumber',
      type: 'VARCHAR(20)',
      required: false
    });

    assert(authWithFields.customFields.length === 2, 'Custom fields added');
    assert(authWithFields.customFields[0].name === 'age', 'Age field exists');
    assert(authWithFields.customFields[1].name === 'phoneNumber', 'Phone field exists');
  } catch (error) {
    log(`✗ Custom fields failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 4: Reserved Field Protection
  log('\n4. Testing Reserved Field Protection...', 'yellow');
  try {
    const auth = new SecureNodeAuth({
      connection: { host: 'localhost', user: 'test', password: 'test', database: 'test' },
      jwt: { accessSecret: 'test-secret-min-32-chars-long-abc', refreshSecret: 'test-refresh-min-32-chars-long-xyz' }
    });

    let errorThrown = false;
    try {
      auth.addField({ name: 'password', type: 'VARCHAR(255)' });
    } catch (error) {
      errorThrown = error.message.includes('reserved');
    }

    assert(errorThrown, 'Reserved field "password" rejected');
  } catch (error) {
    log(`✗ Reserved field test failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 5: Express Middleware
  log('\n5. Testing Express Middleware...', 'yellow');
  try {
    const AuthRoutes = require('./src/middleware/AuthRoutes');
    const auth = new SecureNodeAuth({
      connection: { host: 'localhost', user: 'test', password: 'test', database: 'test' },
      jwt: { accessSecret: 'test-secret-min-32-chars-long-abc', refreshSecret: 'test-refresh-min-32-chars-long-xyz' }
    });

    const routes = new AuthRoutes(auth);
    const router = routes.getRouter();

    assert(routes !== null, 'AuthRoutes instance created');
    assert(router !== null, 'Express router exists');
    assert(router.stack !== undefined, 'Router has routes');
    assert(router.stack.length > 0, 'Routes registered');
    assert(typeof routes._register === 'function', '_register handler exists');
    assert(typeof routes._login === 'function', '_login handler exists');
    assert(typeof routes._verifyEmail === 'function', '_verifyEmail handler exists');
    assert(typeof routes._resetPassword === 'function', '_resetPassword handler exists');
  } catch (error) {
    log(`✗ Express middleware failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 6: Fastify Middleware
  log('\n6. Testing Fastify Middleware...', 'yellow');
  try {
    const FastifyRoutes = require('./src/middleware/FastifyRoutes');
    const auth = new SecureNodeAuth({
      connection: { host: 'localhost', user: 'test', password: 'test', database: 'test' },
      jwt: { accessSecret: 'test-secret-min-32-chars-long-abc', refreshSecret: 'test-refresh-min-32-chars-long-xyz' }
    });

    const routes = new FastifyRoutes(auth);

    assert(routes !== null, 'FastifyRoutes instance created');
    assert(routes.auth !== undefined, 'Auth instance attached');
    assert(typeof routes.register === 'function', 'register() method exists');
    assert(typeof routes._register === 'function', '_register handler exists');
    assert(typeof routes._login === 'function', '_login handler exists');
    assert(typeof routes._fastifyAuthMiddleware === 'function', '_fastifyAuthMiddleware exists');
    assert(typeof routes._verifyEmail === 'function', '_verifyEmail handler exists');
    assert(typeof routes._resetPassword === 'function', '_resetPassword handler exists');
  } catch (error) {
    log(`✗ Fastify middleware failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 7: Fastify Plugin
  log('\n7. Testing Fastify Plugin...', 'yellow');
  try {
    const secureNodeAuthPlugin = require('./src/middleware/FastifyPlugin');
    
    assert(secureNodeAuthPlugin !== null, 'Fastify plugin loaded');
    assert(typeof secureNodeAuthPlugin === 'function', 'Plugin is a function');
    // Check for fastify-plugin wrapper properties
    assert(secureNodeAuthPlugin[Symbol.for('skip-override')] !== undefined || 
           secureNodeAuthPlugin[Symbol.for('fastify.display-name')] !== undefined,
           'Plugin wrapped with fastify-plugin');
  } catch (error) {
    log(`✗ Fastify plugin failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 8: Database Schema Validation
  log('\n8. Testing Database Schema Validation...', 'yellow');
  try {
    const auth = new SecureNodeAuth({
      connection: { host: 'localhost', user: 'test', password: 'test', database: 'test' },
      jwt: { accessSecret: 'test-secret-min-32-chars-long-abc', refreshSecret: 'test-refresh-min-32-chars-long-xyz' }
    });

    assert(auth.options.tables.users === 'secure_auth_users', 'Users table name correct');
    assert(auth.options.tables.refreshTokens === 'secure_auth_refresh_tokens', 'Refresh tokens table name correct');
    assert(auth.options.tables.loginAttempts === 'secure_auth_login_attempts', 'Login attempts table name correct');
    assert(auth.options.tables.verificationTokens === 'secure_auth_verification_tokens', 'Verification tokens table name correct');
  } catch (error) {
    log(`✗ Database schema validation failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 9: Security Options
  log('\n9. Testing Security Options...', 'yellow');
  try {
    const auth = new SecureNodeAuth({
      connection: { host: 'localhost', user: 'test', password: 'test', database: 'test' },
      jwt: { accessSecret: 'test-secret-min-32-chars-long-abc', refreshSecret: 'test-refresh-min-32-chars-long-xyz' },
      security: {
        bcryptRounds: 12,
        maxLoginAttempts: 3,
        lockoutTime: 10 * 60 * 1000,
        requireEmailVerification: true
      }
    });

    assert(auth.options.security.bcryptRounds === 12, 'Bcrypt rounds configured');
    assert(auth.options.security.maxLoginAttempts === 3, 'Max login attempts configured');
    assert(auth.options.security.lockoutTime === 600000, 'Lockout time configured');
    assert(auth.options.security.requireEmailVerification === true, 'Email verification required');
  } catch (error) {
    log(`✗ Security options failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 10: Token Service
  log('\n10. Testing Token Service...', 'yellow');
  try {
    const TokenService = require('./src/core/TokenService');
    const tokenService = new TokenService({
      accessSecret: 'test-secret-min-32-chars-long-abc',
      refreshSecret: 'test-refresh-min-32-chars-long-xyz',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d'
    });

    assert(tokenService !== null, 'TokenService instance created');
    assert(typeof tokenService.generateTokens === 'function', 'generateTokens() exists');
    assert(typeof tokenService.verifyAccessToken === 'function', 'verifyAccessToken() exists');
    assert(typeof tokenService.verifyRefreshToken === 'function', 'verifyRefreshToken() exists');
  } catch (error) {
    log(`✗ Token service failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 11: Email Service
  log('\n11. Testing Email Service...', 'yellow');
  try {
    const EmailService = require('./src/core/EmailService');
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'test',
      password: 'test',
      database: 'test'
    });

    const emailService = new EmailService(
      {
        smtp: {
          host: 'smtp.example.com',
          port: 587,
          auth: { user: 'test@example.com', pass: 'password' }
        }
      },
      pool,
      {
        users: 'secure_auth_users',
        verificationTokens: 'secure_auth_verification_tokens'
      }
    );

    assert(emailService !== null, 'EmailService instance created');
    assert(typeof emailService.sendVerificationEmail === 'function', 'sendVerificationEmail() exists');
    assert(typeof emailService.verifyEmail === 'function', 'verifyEmail() exists');
    assert(typeof emailService.resendVerificationEmail === 'function', 'resendVerificationEmail() exists');
    assert(typeof emailService.sendPasswordResetEmail === 'function', 'sendPasswordResetEmail() exists');
    assert(typeof emailService.generateToken === 'function', 'generateToken() exists');
    assert(typeof emailService.cleanupExpiredTokens === 'function', 'cleanupExpiredTokens() exists');
    
    await pool.end();
  } catch (error) {
    log(`✗ Email service failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Test 12: Package Dependencies
  log('\n12. Testing Package Dependencies...', 'yellow');
  try {
    const packageJson = require('./package.json');
    
    assert(packageJson.dependencies['mysql2'] !== undefined, 'mysql2 dependency exists');
    assert(packageJson.dependencies['jsonwebtoken'] !== undefined, 'jsonwebtoken dependency exists');
    assert(packageJson.dependencies['bcrypt'] !== undefined, 'bcrypt dependency exists');
    assert(packageJson.dependencies['nodemailer'] !== undefined, 'nodemailer dependency exists');
    assert(packageJson.dependencies['fastify'] !== undefined, 'fastify dependency exists');
    assert(packageJson.dependencies['fastify-plugin'] !== undefined, 'fastify-plugin dependency exists');
    assert(packageJson.dependencies['@fastify/rate-limit'] !== undefined, '@fastify/rate-limit dependency exists');
    assert(packageJson.dependencies['express-rate-limit'] !== undefined, 'express-rate-limit dependency exists');
  } catch (error) {
    log(`✗ Package dependencies check failed: ${error.message}`, 'red');
    testsFailed++;
  }

  // Final Results
  log('\n════════════════════════════════════════', 'blue');
  log('  Test Results', 'blue');
  log('════════════════════════════════════════', 'blue');
  log(`Total Tests: ${testsPassed + testsFailed}`, 'yellow');
  log(`Passed: ${testsPassed}`, 'green');
  log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'green');
  
  if (testsFailed === 0) {
    log('\n✓ All tests passed! Package is ready.', 'green');
  } else {
    log(`\n✗ ${testsFailed} test(s) failed. Please review.`, 'red');
  }
  log('════════════════════════════════════════\n', 'blue');

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
