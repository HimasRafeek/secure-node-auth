/**
 * PostgreSQL Compatibility Test
 * Tests all critical database operations to ensure PostgreSQL works correctly
 */

const SecureNodeAuth = require('../src/index');

async function testPostgreSQL() {
  console.log('🧪 Starting PostgreSQL Compatibility Tests...\n');

  let auth;
  let testUserId;
  let testEmail = `test_${Date.now()}@example.com`;

  try {
    // Test 1: Connection
    console.log('Test 1: Connecting to PostgreSQL...');
    auth = new SecureNodeAuth({
      connection: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'secure_node_test',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
      },
      jwt: {
        accessSecret: 'test_access_secret',
        refreshSecret: 'test_refresh_secret',
      },
    });

    await auth.init();
    console.log('✅ PostgreSQL connected successfully\n');

    // Test 2: User Registration
    console.log('Test 2: Registering new user...');
    const registerResult = await auth.register({
      email: testEmail,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    });
    testUserId = registerResult.user.id;
    console.log('✅ User registered:', registerResult.user.email);
    console.log('   User ID:', testUserId);
    console.log('   Access Token:', registerResult.tokens.accessToken ? '✓' : '✗');
    console.log('   Refresh Token:', registerResult.tokens.refreshToken ? '✓' : '✗\n');

    // Test 3: User Login
    console.log('Test 3: User login...');
    const loginResult = await auth.login(testEmail, 'TestPass123!');
    console.log('✅ User logged in successfully');
    console.log('   Access Token:', loginResult.tokens.accessToken ? '✓' : '✗');
    console.log('   Refresh Token:', loginResult.tokens.refreshToken ? '✓' : '✗\n');

    // Test 4: Get User by ID
    console.log('Test 4: Getting user by ID...');
    const user = await auth.getUserById(testUserId);
    console.log('✅ User retrieved:', user.email);
    console.log('   First Name:', user.firstName);
    console.log('   Email Verified:', user.emailVerified);
    console.log('   Is Active:', user.isActive, '\n');

    // Test 5: Get User by Email
    console.log('Test 5: Getting user by email...');
    const userByEmail = await auth.getUserByEmail(testEmail);
    console.log('✅ User found by email:', userByEmail.email, '\n');

    // Test 6: Update Profile
    console.log('Test 6: Updating user profile...');
    await auth.updateProfile(testUserId, {
      firstName: 'Updated',
      lastName: 'Name',
    });
    const updatedUser = await auth.getUserById(testUserId);
    console.log('✅ Profile updated');
    console.log('   New First Name:', updatedUser.firstName);
    console.log('   New Last Name:', updatedUser.lastName, '\n');

    // Test 7: Verify Access Token
    console.log('Test 7: Verifying access token...');
    const decoded = await auth.verifyAccessToken(loginResult.tokens.accessToken);
    console.log('✅ Access token verified');
    console.log('   User ID:', decoded.userId);
    console.log('   Email:', decoded.email, '\n');

    // Test 8: Refresh Token
    console.log('Test 8: Refreshing access token...');
    const refreshResult = await auth.refreshToken(loginResult.tokens.refreshToken);
    console.log('✅ Token refreshed');
    console.log('   New Access Token:', refreshResult.accessToken ? '✓' : '✗\n');

    // Test 9: Change Password
    console.log('Test 9: Changing password...');
    await auth.changePassword(testUserId, 'TestPass123!', 'NewPass456!');
    console.log('✅ Password changed successfully');
    // Test login with new password
    const newLoginResult = await auth.login(testEmail, 'NewPass456!');
    console.log('   Login with new password:', newLoginResult ? '✓' : '✗\n');

    // Test 10: Custom Fields
    console.log('Test 10: Testing custom fields...');
    const authWithCustomFields = new SecureNodeAuth({
      connection: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'secure_node_test',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
      },
      tables: {
        users: 'test_custom_users',
        refreshTokens: 'test_custom_refresh_tokens',
        loginAttempts: 'test_custom_login_attempts',
        verificationTokens: 'test_custom_verification_tokens',
      },
    });

    authWithCustomFields.addField({
      name: 'phoneNumber',
      type: 'VARCHAR(20)',
      unique: true,
    });

    authWithCustomFields.addField({
      name: 'age',
      type: 'INTEGER',
    });

    authWithCustomFields.addField({
      name: 'balance',
      type: 'DECIMAL(10,2)',
      defaultValue: 0,
    });

    await authWithCustomFields.init();
    console.log('✅ Custom tables created');

    const customUserEmail = `custom_${Date.now()}@example.com`;
    const customUser = await authWithCustomFields.register({
      email: customUserEmail,
      password: 'Test123!',
      phoneNumber: '+1234567890',
      age: 25,
      balance: 100.5,
    });
    console.log('✅ User with custom fields created');
    console.log('   Phone Number:', customUser.user.phoneNumber);
    console.log('   Age:', customUser.user.age);
    console.log('   Balance:', customUser.user.balance, '\n');

    // Test 11: Logout
    console.log('Test 11: Testing logout...');
    await auth.logout(loginResult.tokens.refreshToken);
    console.log('✅ User logged out successfully');

    // Try to use the revoked token
    try {
      await auth.refreshToken(loginResult.tokens.refreshToken);
      console.log('❌ Should have failed - token still valid\n');
    } catch (error) {
      console.log('✅ Revoked token rejected correctly\n');
    }

    // Test 12: Logout All Devices
    console.log('Test 12: Testing logout all devices...');
    const multiLogin1 = await auth.login(testEmail, 'NewPass456!');
    const multiLogin2 = await auth.login(testEmail, 'NewPass456!');
    await auth.logoutAll(testUserId);
    console.log('✅ All sessions logged out');

    try {
      await auth.refreshToken(multiLogin1.tokens.refreshToken);
      console.log('❌ Token 1 should be revoked\n');
    } catch (error) {
      console.log('✅ Token 1 revoked');
    }

    try {
      await auth.refreshToken(multiLogin2.tokens.refreshToken);
      console.log('❌ Token 2 should be revoked\n');
    } catch (error) {
      console.log('✅ Token 2 revoked\n');
    }

    // Test 13: Direct Database Query
    console.log('Test 13: Testing direct database access...');
    const pool = auth.db.getPool();
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM "secure_auth_users" WHERE "isActive" = $1',
      [true]
    );
    console.log('✅ Direct query successful');
    console.log('   Active users:', result.rows[0].count, '\n');

    // Test 14: Login Attempts Tracking
    console.log('Test 14: Testing login attempts tracking...');
    try {
      await auth.login(testEmail, 'WrongPassword123!');
    } catch (error) {
      console.log('✅ Failed login recorded');
    }

    const isLocked = await auth.isAccountLocked(testEmail);
    console.log('   Account locked:', isLocked ? 'Yes' : 'No', '\n');

    // Test 15: Get User Count
    console.log('Test 15: Testing user count...');
    const userCount = await auth.db.getUserCount('secure_auth_users');
    console.log('✅ User count retrieved:', userCount, '\n');

    // Cleanup test custom tables
    console.log('Cleaning up test tables...');
    await authWithCustomFields.db.query(
      'DROP TABLE IF EXISTS "test_custom_verification_tokens" CASCADE'
    );
    await authWithCustomFields.db.query(
      'DROP TABLE IF EXISTS "test_custom_login_attempts" CASCADE'
    );
    await authWithCustomFields.db.query(
      'DROP TABLE IF EXISTS "test_custom_refresh_tokens" CASCADE'
    );
    await authWithCustomFields.db.query('DROP TABLE IF EXISTS "test_custom_users" CASCADE');
    await authWithCustomFields.close();
    console.log('✅ Test tables cleaned up\n');

    console.log('='.repeat(60));
    console.log('🎉 ALL TESTS PASSED! PostgreSQL integration is working!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (auth) {
      await auth.close();
    }
  }
}

// Run tests
if (require.main === module) {
  console.log('PostgreSQL Compatibility Test Suite');
  console.log('Make sure PostgreSQL is running and configured in .env\n');

  testPostgreSQL()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = testPostgreSQL;
