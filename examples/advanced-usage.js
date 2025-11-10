const SecureNodeAuth = require('../src/index');

/**
 * Example: Advanced usage with custom configurations
 */
async function advancedExample() {
  // Create auth instance with custom configuration
  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'your_password',
      database: 'my_app_db'
    },
    jwt: {
      accessSecret: 'my-super-secret-access-key',
      refreshSecret: 'my-super-secret-refresh-key',
      accessExpiresIn: '30m', // 30 minutes
      refreshExpiresIn: '30d' // 30 days
    },
    security: {
      bcryptRounds: 12, // Higher security
      maxLoginAttempts: 3,
      lockoutTime: 30 * 60 * 1000, // 30 minutes
      passwordMinLength: 10,
      passwordRequireUppercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecialChars: true
    },
    tables: {
      users: 'my_users_table',
      refreshTokens: 'my_tokens_table',
      loginAttempts: 'my_login_attempts_table'
    }
  });

  // Add multiple custom fields
  auth
    .addField({
      name: 'phoneNumber',
      type: 'VARCHAR(20)',
      required: true,
      unique: true
    })
    .addField({
      name: 'dateOfBirth',
      type: 'DATE',
      required: false
    })
    .addField({
      name: 'country',
      type: 'VARCHAR(100)',
      required: false,
      defaultValue: 'USA'
    })
    .addField({
      name: 'subscriptionTier',
      type: "ENUM('free', 'premium', 'enterprise')",
      required: false,
      defaultValue: 'free'
    });

  // Register hooks for business logic
  auth.on('beforeRegister', async (userData) => {
    console.log('Before register hook:', userData.email);
    // Add custom validation, check blacklist, etc.
  });

  auth.on('afterRegister', async (result) => {
    console.log('After register hook:', result.user.email);
    // Send welcome email, create user profile, etc.
    // await sendWelcomeEmail(result.user.email);
  });

  auth.on('beforeLogin', async (data) => {
    console.log('Before login attempt:', data.email);
    // Log login attempts, check IP blacklist, etc.
  });

  auth.on('afterLogin', async (result) => {
    console.log('After login:', result.user.email);
    // Track analytics, update last login time, etc.
  });

  // Initialize
  await auth.init();

  // Register a user with custom fields
  try {
    const registration = await auth.register({
      email: 'john@example.com',
      password: 'SecureP@ss123',
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '+1234567890',
      country: 'USA',
      subscriptionTier: 'premium'
    });
    
    console.log('User registered:', registration.user);
    console.log('Access token:', registration.tokens.accessToken);
  } catch (error) {
    console.error('Registration failed:', error.message);
  }

  // Login
  try {
    const login = await auth.login('john@example.com', 'SecureP@ss123');
    console.log('Login successful:', login.user);
  } catch (error) {
    console.error('Login failed:', error.message);
  }

  // Update user with custom fields
  try {
    const userId = 1; // Example user ID
    const updated = await auth.updateUser(userId, {
      firstName: 'Johnny',
      country: 'Canada',
      subscriptionTier: 'enterprise'
    });
    console.log('User updated:', updated);
  } catch (error) {
    console.error('Update failed:', error.message);
  }

  // Close connection
  await auth.close();
}

// Only run if executed directly
if (require.main === module) {
  advancedExample()
    .then(() => console.log('✅ Advanced example completed'))
    .catch(error => console.error('❌ Error:', error));
}

module.exports = advancedExample;
