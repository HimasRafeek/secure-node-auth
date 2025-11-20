/**
 * Test Suite for Dangerous Migration Features
 * Tests dangerouslyAddColumn() and dangerouslyMigrateSchema()
 */

const SecureNodeAuth = require('./src/index');

// Try to load dotenv if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, use environment variables directly
}

async function testDangerousMigration() {
  console.log('🧪 Testing Dangerous Migration Features\n');
  console.log('⚠️  This test will modify your database schema');
  console.log('   Make sure you are using a test database!\n');

  let auth;
  const testTablePrefix = `test_danger_${Date.now()}_`;

  try {
    // Test 1: Initialize with test tables
    console.log('Test 1: Initializing auth system...');
    auth = new SecureNodeAuth({
      connection: {
        type: process.env.DB_TYPE || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'secure_node_test',
        port: parseInt(process.env.DB_PORT, 10) || (process.env.DB_TYPE === 'mysql' ? 3306 : 5432),
      },
      tables: {
        users: `${testTablePrefix}users`,
        refreshTokens: `${testTablePrefix}refresh_tokens`,
        loginAttempts: `${testTablePrefix}login_attempts`,
        verificationTokens: `${testTablePrefix}verification_tokens`,
      },
      jwt: {
        accessSecret: 'test_secret',
        refreshSecret: 'test_refresh_secret',
      },
    });

    await auth.init();
    console.log('✅ Auth system initialized\n');

    // Test 2: Create some test users first
    console.log('Test 2: Creating test users...');
    const user1 = await auth.register({
      email: `user1_${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'John',
      lastName: 'Doe',
    });
    const user2 = await auth.register({
      email: `user2_${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'Jane',
      lastName: 'Smith',
    });
    console.log(`✅ Created ${2} test users\n`);

    // Test 3: Try without confirmation (should fail)
    console.log('Test 3: Testing safety - attempt without confirmation...');
    try {
      await auth.dangerouslyAddColumn({
        name: 'phoneNumber',
        type: 'VARCHAR(20)',
      });
      console.log('❌ Should have required confirmation\n');
      process.exit(1);
    } catch (error) {
      if (error.message.includes('CONFIRMATION REQUIRED')) {
        console.log('✅ Confirmation correctly required');
        console.log(`   Error message shown: "${error.message.split('\n')[1].trim()}"\n`);
      } else {
        throw error;
      }
    }

    // Test 4: Add single column with confirmation
    console.log('Test 4: Adding single column with confirmation...');
    const result1 = await auth.dangerouslyAddColumn({
      name: 'phoneNumber',
      type: 'VARCHAR(20)',
      unique: true,
    }, { confirmed: true });

    if (result1.success && !result1.skipped) {
      console.log('✅ Column "phoneNumber" added successfully');
      console.log(`   Duration: ${result1.duration}\n`);
    } else {
      console.log('❌ Failed to add column\n');
      process.exit(1);
    }

    // Test 5: Try adding same column again (should skip)
    console.log('Test 5: Testing skipIfExists - adding same column...');
    const result2 = await auth.dangerouslyAddColumn({
      name: 'phoneNumber',
      type: 'VARCHAR(20)',
    }, { confirmed: true, skipIfExists: true });

    if (result2.success && result2.skipped) {
      console.log('✅ Column correctly skipped (already exists)');
      console.log(`   Reason: ${result2.reason}\n`);
    } else {
      console.log('❌ Should have skipped existing column\n');
      process.exit(1);
    }

    // Test 6: Use new field in registration
    console.log('Test 6: Registering user with new custom field...');
    const user3 = await auth.register({
      email: `user3_${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'Bob',
      lastName: 'Johnson',
      phoneNumber: `+1${Date.now().toString().slice(-10)}`,
    });

    if (user3.user.phoneNumber) {
      console.log('✅ User registered with custom field');
      console.log(`   Phone: ${user3.user.phoneNumber}\n`);
    } else {
      console.log('❌ Custom field not saved\n');
      process.exit(1);
    }

    // Test 7: Update existing user with new field
    console.log('Test 7: Updating existing user with new field...');
    await auth.updateProfile(user1.user.id, {
      phoneNumber: `+1${Date.now().toString().slice(-10)}`,
    });
    const updatedUser = await auth.getUserById(user1.user.id);
    
    if (updatedUser.phoneNumber) {
      console.log('✅ Existing user updated with new field');
      console.log(`   Phone: ${updatedUser.phoneNumber}\n`);
    } else {
      console.log('❌ Field not updated\n');
      process.exit(1);
    }

    // Test 8: Add column with default value
    console.log('Test 8: Adding column with default value...');
    await auth.dangerouslyAddColumn({
      name: 'accountType',
      type: 'VARCHAR(20)',
      defaultValue: 'free',
      required: false,
    }, { confirmed: true });

    const userWithDefault = await auth.getUserById(user1.user.id);
    if (userWithDefault.accountType === 'free') {
      console.log('✅ Column with default value added');
      console.log(`   Default value applied: ${userWithDefault.accountType}\n`);
    } else {
      console.log('❌ Default value not applied\n');
      process.exit(1);
    }

    // Test 9: Bulk migration with multiple columns
    console.log('Test 9: Testing bulk migration (3 columns)...');
    const bulkResult = await auth.dangerouslyMigrateSchema([
      { name: 'age', type: 'INTEGER', defaultValue: 0 },
      { name: 'city', type: 'VARCHAR(100)' },
      { name: 'isVerified', type: 'BOOLEAN', defaultValue: false },
    ], { confirmed: true });

    if (bulkResult.success && bulkResult.fieldsAdded === 3) {
      console.log('✅ Bulk migration successful');
      console.log(`   Fields added: ${bulkResult.fieldsAdded}`);
      console.log(`   Fields skipped: ${bulkResult.fieldsSkipped}`);
      console.log(`   Duration: ${bulkResult.duration}s`);
      console.log(`   Columns: ${bulkResult.columns.join(', ')}\n`);
    } else {
      console.log('❌ Bulk migration failed\n');
      process.exit(1);
    }

    // Test 10: Register user with all new fields
    console.log('Test 10: Registering user with all custom fields...');
    const user4 = await auth.register({
      email: `user4_${Date.now()}@test.com`,
      password: 'Test123!',
      firstName: 'Alice',
      lastName: 'Williams',
      phoneNumber: `+1${Date.now().toString().slice(-10)}`,
      accountType: 'premium',
      age: 25,
      city: 'New York',
      isVerified: true,
    });

    console.log('✅ User registered with all custom fields:');
    console.log(`   Phone: ${user4.user.phoneNumber}`);
    console.log(`   Account Type: ${user4.user.accountType}`);
    console.log(`   Age: ${user4.user.age}`);
    console.log(`   City: ${user4.user.city}`);
    console.log(`   Verified: ${user4.user.isVerified}\n`);

    // Test 11: Test reserved field name (should fail)
    console.log('Test 11: Testing reserved field name protection...');
    try {
      await auth.dangerouslyAddColumn({
        name: 'password',
        type: 'VARCHAR(255)',
      }, { confirmed: true });
      console.log('❌ Should have rejected reserved field name\n');
      process.exit(1);
    } catch (error) {
      if (error.message.includes('reserved')) {
        console.log('✅ Reserved field name correctly rejected');
        console.log(`   Field: password\n`);
      } else {
        throw error;
      }
    }

    // Test 12: Test invalid field name (should fail)
    console.log('Test 12: Testing invalid field name protection...');
    try {
      await auth.dangerouslyAddColumn({
        name: 'invalid-field-name',
        type: 'VARCHAR(255)',
      }, { confirmed: true });
      console.log('❌ Should have rejected invalid field name\n');
      process.exit(1);
    } catch (error) {
      if (error.message.includes('Invalid field name')) {
        console.log('✅ Invalid field name correctly rejected');
        console.log(`   Field: invalid-field-name\n`);
      } else {
        throw error;
      }
    }

    // Test 13: Test adding required field without default (should fail if data exists)
    console.log('Test 13: Testing required field without default...');
    try {
      await auth.dangerouslyAddColumn({
        name: 'requiredField',
        type: 'VARCHAR(255)',
        required: true,
        // No defaultValue
      }, { confirmed: true });
      console.log('❌ Should have required default value for required field\n');
      process.exit(1);
    } catch (error) {
      if (error.message.includes('without a default value')) {
        console.log('✅ Required field without default correctly rejected');
        console.log('   (Table has existing rows)\n');
      } else {
        throw error;
      }
    }

    // Test 14: Verify all fields are accessible
    console.log('Test 14: Verifying all custom fields are accessible...');
    const finalUser = await auth.getUserById(user4.user.id);
    const expectedFields = ['phoneNumber', 'accountType', 'age', 'city', 'isVerified'];
    const missingFields = expectedFields.filter(field => !(field in finalUser));

    if (missingFields.length === 0) {
      console.log('✅ All custom fields are accessible');
      console.log(`   Fields checked: ${expectedFields.join(', ')}\n`);
    } else {
      console.log(`❌ Missing fields: ${missingFields.join(', ')}\n`);
      process.exit(1);
    }

    console.log('='.repeat(70));
    console.log('🎉 ALL DANGEROUS MIGRATION TESTS PASSED!');
    console.log('='.repeat(70));
    console.log('✅ dangerouslyAddColumn() works correctly');
    console.log('✅ dangerouslyMigrateSchema() works correctly');
    console.log('✅ Safety checks are in place');
    console.log('✅ Custom fields are functional');
    console.log('✅ Error handling works properly');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup: Drop test tables
    if (auth) {
      console.log('Cleaning up test tables...');
      try {
        const isPostgres = auth.options.connection.type === 'postgres';
        const quote = isPostgres ? '"' : '`';
        
        await auth.db.query(`DROP TABLE IF EXISTS ${quote}${testTablePrefix}verification_tokens${quote} CASCADE`);
        await auth.db.query(`DROP TABLE IF EXISTS ${quote}${testTablePrefix}login_attempts${quote} CASCADE`);
        await auth.db.query(`DROP TABLE IF EXISTS ${quote}${testTablePrefix}refresh_tokens${quote} CASCADE`);
        await auth.db.query(`DROP TABLE IF EXISTS ${quote}${testTablePrefix}users${quote} CASCADE`);
        
        console.log('✅ Test tables cleaned up\n');
      } catch (cleanupError) {
        console.warn('⚠️  Cleanup warning:', cleanupError.message);
      }

      await auth.close();
    }
  }
}

// Run tests
if (require.main === module) {
  console.log('Dangerous Migration Test Suite');
  console.log('Make sure you are using a TEST database!\n');

  testDangerousMigration()
    .then(() => {
      console.log('✅ Test suite completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = testDangerousMigration;
