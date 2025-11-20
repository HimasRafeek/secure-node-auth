# Fastify Integration Guide

> **v1.4.3+**: Works seamlessly with MySQL and PostgreSQL. Automatic database compatibility.

Complete guide for using SecureNodeAuth with Fastify framework.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install secure-node-auth fastify @fastify/rate-limit fastify-plugin mysql2
```

### 2. Basic Setup

```javascript
const fastify = require('fastify')({ logger: true });
const SecureNodeAuth = require('secure-node-auth');
const secureNodeAuthPlugin = require('secure-node-auth/src/middleware/FastifyPlugin');

// Initialize auth
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
  }
});

// Initialize database
await auth.init();

// Register plugin (includes all auth routes)
await fastify.register(secureNodeAuthPlugin, {
  authInstance: auth,
  routeOptions: {
    prefix: '/auth', // Default prefix
    verificationUrl: 'http://localhost:3000/verify-email',
    passwordResetUrl: 'http://localhost:3000/reset-password'
  }
});

// Start server
await fastify.listen({ port: 3000 });
console.log('Server running on http://localhost:3000');
```

---

## 📋 Available Routes

Once registered, you get these routes automatically:

### Authentication Routes
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout (revoke refresh token)
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/me` - Get current user (protected)
- `PATCH /auth/me` - Update user profile (protected)
- `POST /auth/change-password` - Change password (protected)
- `POST /auth/verify` - Verify access token
- `GET /auth/health` - Health check

### Email Verification Routes
- `POST /auth/send-verification-email` - Send verification email (URL method)
- `POST /auth/verify-email` - Verify email with token (URL method)
- `POST /auth/resend-verification-email` - Resend verification email
- `POST /auth/send-verification-code` - Send 6-digit verification code
- `POST /auth/verify-code` - Verify email with 6-digit code

### Password Reset Routes
- `POST /auth/forgot-password` - Send password reset email (URL method)
- `POST /auth/reset-password` - Reset password with token (URL method)
- `POST /auth/send-password-reset-code` - Send 6-digit reset code
- `POST /auth/reset-password-with-code` - Reset password with 6-digit code

---

## 🔒 Protecting Routes

### Using the Plugin Decorator

```javascript
// The plugin adds fastify.authenticate decorator
fastify.get('/protected', {
  preHandler: fastify.authenticate
}, async (request, reply) => {
  // request.user is available (from JWT)
  return {
    message: 'This is protected!',
    user: request.user
  };
});

// Multiple preHandlers
fastify.post('/admin-only', {
  preHandler: [fastify.authenticate, checkAdminRole]
}, async (request, reply) => {
  return { message: 'Admin access granted' };
});
```

### Manual Authentication

```javascript
// Without plugin, use auth instance directly
fastify.addHook('preHandler', async (request, reply) => {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = await auth.verifyAccessToken(token);
    request.user = decoded;
  } catch (error) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
});
```

---

## 💡 Complete Example

```javascript
const fastify = require('fastify')({ logger: true });
const SecureNodeAuth = require('secure-node-auth');
const secureNodeAuthPlugin = require('secure-node-auth/src/middleware/FastifyPlugin');

async function buildApp() {
  // Initialize auth
  const auth = new SecureNodeAuth({
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'myapp'
    },
    jwt: {
      accessSecret: 'your-32-char-secret-here',
      refreshSecret: 'your-32-char-refresh-secret'
    },
    smtp: {
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    verificationUrl: 'http://localhost:3000/verify-email',
    passwordResetUrl: 'http://localhost:3000/reset-password'
  });

  await auth.init();

  // Register auth plugin
  await fastify.register(secureNodeAuthPlugin, {
    authInstance: auth,
    routeOptions: {
      prefix: '/api/auth',
      enableRateLimit: true,
      rateLimitMax: 10,
      rateLimitWindow: 15 * 60 * 1000 // 15 minutes
    }
  });

  // Public route
  fastify.get('/', async (request, reply) => {
    return { message: 'Welcome to the API' };
  });

  // Protected route using decorator
  fastify.get('/api/profile', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const user = await auth.getUserById(request.user.userId);
    return { user };
  });

  // Protected route with custom logic
  fastify.get('/api/dashboard', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const isVerified = await auth.isEmailVerified(request.user.userId);
    
    if (!isVerified) {
      return reply.code(403).send({
        error: 'Please verify your email first'
      });
    }

    return {
      message: 'Welcome to dashboard',
      userId: request.user.userId
    };
  });

  // Custom endpoint using auth methods
  fastify.post('/api/custom-register', async (request, reply) => {
    try {
      const { email, password, customField } = request.body;
      
      const result = await auth.register({
        email,
        password,
        customField
      });

      return reply.code(201).send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.code(400).send({
        error: error.message
      });
    }
  });

  return fastify;
}

// Start server
buildApp()
  .then(app => app.listen({ port: 3000 }))
  .then(() => console.log('🚀 Server running on http://localhost:3000'))
  .catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
```

---

## 🎨 Custom Route Configuration

### Disable Auto Routes

```javascript
await fastify.register(secureNodeAuthPlugin, {
  authInstance: auth,
  routeOptions: {
    registerRoutes: false // Don't auto-register routes
  }
});

// Now you can create custom routes manually
const FastifyRoutes = require('secure-node-auth/src/middleware/FastifyRoutes');
const routes = new FastifyRoutes(auth);

fastify.post('/custom/login', async (request, reply) => {
  // Use routes._login or call auth.login() directly
  const { email, password } = request.body;
  const result = await auth.login(email, password);
  return result;
});
```

### Custom Prefix

```javascript
await fastify.register(secureNodeAuthPlugin, {
  authInstance: auth,
  routeOptions: {
    prefix: '/api/v1/authentication' // Custom prefix
  }
});

// Routes are now at /api/v1/authentication/login, etc.
```

---

## 🔧 Schema Validation

Fastify has built-in JSON schema validation. All routes include schemas:

```javascript
// Example: Register route schema
{
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      firstName: { type: 'string' },
      lastName: { type: 'string' }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: { type: 'object' }
      }
    }
  }
}
```

### Custom Validation

```javascript
fastify.post('/custom-register', {
  schema: {
    body: {
      type: 'object',
      required: ['email', 'password', 'age'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 10 },
        age: { type: 'number', minimum: 18 }
      }
    }
  }
}, async (request, reply) => {
  const result = await auth.register(request.body);
  return result;
});
```

---

## ⚡ Performance Features

### Rate Limiting

Built-in rate limiting using `@fastify/rate-limit`:

```javascript
await fastify.register(secureNodeAuthPlugin, {
  authInstance: auth,
  routeOptions: {
    enableRateLimit: true,
    rateLimitMax: 5, // 5 requests
    rateLimitWindow: 60 * 1000 // per minute
  }
});
```

### Custom Rate Limits Per Route

```javascript
// After registering plugin
fastify.post('/sensitive-endpoint', {
  preHandler: fastify.authenticate,
  config: {
    rateLimit: {
      max: 2,
      timeWindow: 60 * 1000
    }
  }
}, async (request, reply) => {
  return { message: 'Sensitive operation' };
});
```

---

## 🧪 Testing

```javascript
const { test } = require('tap');
const buildApp = require('./app'); // Your app factory

test('POST /auth/register creates user', async t => {
  const app = await buildApp();
  
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: 'test@example.com',
      password: 'SecurePass123!'
    }
  });

  t.equal(response.statusCode, 201);
  const json = response.json();
  t.ok(json.success);
  t.ok(json.data.tokens.accessToken);
  
  await app.close();
});

test('GET /auth/me requires authentication', async t => {
  const app = await buildApp();
  
  // Without token
  const response1 = await app.inject({
    method: 'GET',
    url: '/auth/me'
  });
  t.equal(response1.statusCode, 401);

  // With token
  const registerRes = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: 'test2@example.com',
      password: 'SecurePass123!'
    }
  });
  const { accessToken } = registerRes.json().data.tokens;

  const response2 = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  t.equal(response2.statusCode, 200);
  t.ok(response2.json().data);
  
  await app.close();
});
```

---

## 🔄 Comparison: Express vs Fastify

| Feature | Express | Fastify |
|---------|---------|---------|
| **Setup** | `app.use('/auth', authRoutes.getRouter())` | `await fastify.register(plugin, options)` |
| **Middleware** | `app.use(auth.middleware())` | `preHandler: fastify.authenticate` |
| **Validation** | `express-validator` | Built-in JSON Schema |
| **Rate Limit** | `express-rate-limit` | `@fastify/rate-limit` |
| **Performance** | ~15k req/sec | ~30k req/sec |
| **Type Safety** | Limited | Strong (with schemas) |
| **Plugin System** | Manual | First-class |

### Express Example
```javascript
const express = require('express');
const AuthRoutes = require('secure-node-auth/src/middleware/AuthRoutes');

const app = express();
app.use(express.json());

const authRoutes = new AuthRoutes(auth);
app.use('/auth', authRoutes.getRouter());

app.get('/protected', auth.middleware(), (req, res) => {
  res.json({ user: req.user });
});

app.listen(3000);
```

### Fastify Example
```javascript
const fastify = require('fastify')();
const secureNodeAuthPlugin = require('secure-node-auth/src/middleware/FastifyPlugin');

await fastify.register(secureNodeAuthPlugin, {
  authInstance: auth,
  routeOptions: { prefix: '/auth' }
});

fastify.get('/protected', {
  preHandler: fastify.authenticate
}, async (request) => {
  return { user: request.user };
});

await fastify.listen({ port: 3000 });
```

---

## 📧 6-Digit Code Examples (Fastify)

### Send Verification Code
```javascript
// Send 6-digit verification code
fastify.post('/custom/send-code', async (request, reply) => {
  const { email } = request.body;
  
  try {
    await auth.sendVerificationCode(email);
    return { success: true, message: 'Code sent!' };
  } catch (error) {
    return reply.code(400).send({ error: error.message });
  }
});
```

### Verify Code
```javascript
// Verify 6-digit code
fastify.post('/custom/verify-code', async (request, reply) => {
  const { email, code } = request.body;
  
  try {
    const result = await auth.verifyCode(email, code);
    return { success: true, message: 'Email verified!', data: result };
  } catch (error) {
    return reply.code(400).send({ error: error.message });
  }
});
```

### Password Reset with Code
```javascript
// Send password reset code
fastify.post('/custom/forgot-password-code', async (request, reply) => {
  const { email } = request.body;
  
  try {
    await auth.sendPasswordResetCode(email);
    return { success: true, message: 'Reset code sent!' };
  } catch (error) {
    return { success: true, message: 'If email exists, code sent.' };
  }
});

// Reset password with code
fastify.post('/custom/reset-with-code', async (request, reply) => {
  const { email, code, newPassword } = request.body;
  
  try {
    const result = await auth.resetPasswordWithCode(email, code, newPassword);
    return { success: true, message: result.message };
  } catch (error) {
    return reply.code(400).send({ error: error.message });
  }
});
```

---

## 📚 Additional Resources

- [Fastify Documentation](https://www.fastify.io/)
- [Fastify Plugin Guide](https://www.fastify.io/docs/latest/Reference/Plugins/)
- [JSON Schema Validation](https://json-schema.org/)
- [SecureNodeAuth Main Docs](../README.md)
- [Email Verification Guide](EMAIL_VERIFICATION_GUIDE.md)
- [6-Digit Code Guide](VERIFICATION_AND_AUDIT_GUIDE.md)

---

## 🎯 Why Choose Fastify?

✅ **2x Faster** than Express  
✅ **Built-in Schema Validation** (no extra dependencies)  
✅ **Type Safety** with TypeScript support  
✅ **Modern Plugin System** for better modularity  
✅ **Logging Built-in** with Pino (production-ready)  
✅ **Async/Await Native** (no callback hell)  

**Bottom Line**: If you're building a new API or need high performance, Fastify is the better choice. If you have an existing Express app, stick with Express support.

---

**Built with ❤️ for developers who love speed and simplicity!**
