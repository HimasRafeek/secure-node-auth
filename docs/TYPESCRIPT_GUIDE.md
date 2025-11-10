# TypeScript Guide

SecureNodeAuth includes full TypeScript definitions for a better development experience with IntelliSense, type checking, and autocomplete.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Type Definitions](#type-definitions)
- [Configuration Types](#configuration-types)
- [Method Types](#method-types)
- [Express Integration](#express-integration)
- [Fastify Integration](#fastify-integration)
- [Custom Types](#custom-types)

## Installation

```bash
npm install secure-node-auth
# TypeScript definitions are included automatically
```

For TypeScript projects, ensure you have the necessary dependencies:

```bash
npm install --save-dev @types/node @types/express
```

## Basic Setup

```typescript
import SecureAuth from 'secure-node-auth';
import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// Initialize with full type safety
const auth = new SecureAuth({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'myapp',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
});

// Type-safe routes
app.use('/auth', auth.routes());

// Protected route with typed user
app.get('/profile', auth.authenticate, (req: Request, res: Response) => {
  // req.user is properly typed
  res.json({ user: req.user });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Type Definitions

### SecureNodeAuthOptions

Main configuration interface:

```typescript
interface SecureNodeAuthOptions {
  // MySQL Connection
  host?: string;
  user?: string;
  password?: string;
  database?: string;
  port?: number;

  // JWT Configuration
  jwtSecret?: string;
  jwtRefreshSecret?: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;

  // Security Settings
  bcryptRounds?: number;
  maxLoginAttempts?: number;
  lockoutDuration?: number;

  // Table Names
  usersTable?: string;
  tokensTable?: string;
  verificationsTable?: string;

  // Email Configuration
  enableEmail?: boolean;
  smtpConfig?: SMTPConfig;

  // Custom Fields
  customUserFields?: CustomFieldDefinition[];
}
```

### User Type

```typescript
interface User {
  id: number;
  email: string;
  password?: string; // Hashed, never returned in responses
  created_at: Date;
  updated_at: Date;
  is_verified?: boolean;
  last_login?: Date;

  // Custom fields are dynamically typed
  [key: string]: any;
}
```

### Authentication Result

```typescript
interface AuthResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}
```

## Configuration Types

### Connection Config

```typescript
interface ConnectionConfig {
  host?: string;
  user?: string;
  password?: string;
  database?: string;
  port?: number;
  waitForConnections?: boolean;
  connectionLimit?: number;
  queueLimit?: number;
}
```

### JWT Config

```typescript
interface JWTConfig {
  accessSecret?: string;
  refreshSecret?: string;
  accessExpiresIn?: string; // e.g., '15m', '1h', '7d'
  refreshExpiresIn?: string; // e.g., '7d', '30d'
}
```

### Security Config

```typescript
interface SecurityConfig {
  bcryptRounds?: number;
  maxLoginAttempts?: number;
  lockoutTime?: number;
  requireEmailVerification?: boolean;
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireNumbers?: boolean;
  passwordRequireSpecialChars?: boolean;
}
```

### SMTP Config

```typescript
interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from?: string;
  fromName?: string;
}
```

## Method Types

### Register

```typescript
async register(data: RegisterData): Promise<AuthResult>

interface RegisterData {
  email: string;
  password: string;
  [key: string]: any; // Custom fields
}
```

### Login

```typescript
async login(credentials: LoginCredentials): Promise<AuthResult>

interface LoginCredentials {
  email: string;
  password: string;
}
```

### Verify Token

```typescript
async verifyToken(token: string): Promise<TokenPayload>

interface TokenPayload {
  userId: number;
  email: string;
  iat: number;
  exp: number;
}
```

### Refresh Token

```typescript
async refreshAccessToken(refreshToken: string): Promise<TokenResult>

interface TokenResult {
  success: boolean;
  accessToken?: string;
  message?: string;
}
```

### Email Verification

```typescript
async sendVerificationEmail(userId: number): Promise<EmailResult>
async verifyEmail(token: string): Promise<VerificationResult>

interface EmailResult {
  success: boolean;
  message: string;
}

interface VerificationResult {
  success: boolean;
  user?: User;
  message: string;
}
```

## Express Integration

### Typed Middleware

```typescript
import { Request, Response, NextFunction } from 'express';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Use the middleware with proper types
app.get('/protected', auth.authenticate, (req: Request, res: Response) => {
  // req.user is typed as User | undefined
  if (req.user) {
    res.json({
      email: req.user.email,
      id: req.user.id,
    });
  }
});
```

### Typed Routes

```typescript
import { Router } from 'express';

const router: Router = auth.routes();

app.use('/auth', router);
```

## Fastify Integration

### Typed Fastify Plugin

```typescript
import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const fastify: FastifyInstance = Fastify({ logger: true });

// Register with types
await fastify.register(auth.fastifyPlugin);

// Typed route with authentication
fastify.get(
  '/profile',
  {
    preHandler: fastify.authenticate,
  },
  async (request: FastifyRequest, reply: FastifyReply) => {
    // request.user is typed
    return { user: request.user };
  }
);
```

### Fastify Type Extensions

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
```

## Custom Types

### Custom User Fields

```typescript
interface CustomFieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json';
  required?: boolean;
  default?: any;
  validate?: (value: any) => boolean;
}

// Example with custom fields
interface MyUser extends User {
  firstName: string;
  lastName: string;
  age: number;
  preferences: {
    theme: string;
    notifications: boolean;
  };
}

const auth = new SecureAuth({
  // ... config
  customUserFields: [
    { name: 'firstName', type: 'string', required: true },
    { name: 'lastName', type: 'string', required: true },
    { name: 'age', type: 'number' },
    { name: 'preferences', type: 'json' },
  ],
});

// Register with typed custom fields
const result = await auth.register({
  email: 'user@example.com',
  password: 'securePass123',
  firstName: 'John',
  lastName: 'Doe',
  age: 30,
  preferences: {
    theme: 'dark',
    notifications: true,
  },
});
```

### Type Guards

```typescript
// Type guard for checking if user is authenticated
function isAuthenticated(user: User | undefined): user is User {
  return user !== undefined;
}

// Usage
app.get('/profile', auth.authenticate, (req: Request, res: Response) => {
  if (isAuthenticated(req.user)) {
    // TypeScript knows req.user is User here
    res.json({ email: req.user.email });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});
```

## Complete TypeScript Example

```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import SecureAuth from 'secure-node-auth';

// Define custom user interface
interface MyAppUser extends User {
  displayName: string;
  role: 'user' | 'admin';
}

// Initialize Express
const app: Express = express();
app.use(express.json());

// Initialize SecureAuth with full configuration
const auth = new SecureAuth({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'myapp',
  port: parseInt(process.env.DB_PORT || '3306'),

  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',

  bcryptRounds: 12,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes

  enableEmail: true,
  smtpConfig: {
    host: process.env.SMTP_HOST!,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
    from: 'noreply@myapp.com',
    fromName: 'MyApp',
  },

  customUserFields: [
    { name: 'displayName', type: 'string', required: true },
    { name: 'role', type: 'string', default: 'user' },
  ],
});

// Authentication routes
app.use('/auth', auth.routes());

// Type-safe protected route
app.get('/api/profile', auth.authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = req.user as MyAppUser;
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin-only route with role check
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as MyAppUser;
  if (user?.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

app.get(
  '/api/admin/users',
  auth.authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    // Admin-only logic here
    res.json({ message: 'Admin access granted' });
  }
);

// Error handling with types
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Best Practices

### 1. Use Environment Variables

```typescript
import dotenv from 'dotenv';
dotenv.config();

const auth = new SecureAuth({
  host: process.env.DB_HOST!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  jwtSecret: process.env.JWT_SECRET!,
});
```

### 2. Strict Null Checks

Enable `strictNullChecks` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strictNullChecks": true,
    "strict": true
  }
}
```

### 3. Type Assertions Safely

```typescript
// Good - with null check
if (req.user) {
  const user = req.user as MyAppUser;
  console.log(user.displayName);
}

// Bad - without null check
const user = req.user as MyAppUser; // Could be undefined!
```

### 4. Use Interfaces for Custom Data

```typescript
interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

app.post('/register', async (req: Request, res: Response) => {
  const data: RegisterRequest = req.body;
  const result = await auth.register(data);
  res.json(result);
});
```

## Troubleshooting

### Type Errors

If you encounter type errors, ensure:

1. TypeScript version >= 4.0
2. `@types/node` and `@types/express` are installed
3. `tsconfig.json` has proper settings

### IntelliSense Not Working

1. Restart your TypeScript server
2. Check `node_modules/secure-node-auth/src/index.d.ts` exists
3. Verify `package.json` has `"types": "src/index.d.ts"`

### Custom Fields Not Typed

For custom fields, extend the User interface:

```typescript
declare module 'secure-node-auth' {
  interface User {
    customField1?: string;
    customField2?: number;
  }
}
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Express with TypeScript](https://expressjs.com/en/advanced/typescript.html)
- [Fastify with TypeScript](https://www.fastify.io/docs/latest/Reference/TypeScript/)

## Support

For TypeScript-specific issues, please check:

- GitHub Issues: https://github.com/yourusername/secure-node-auth/issues
- Documentation: https://secure-node-auth.dev/docs/typescript
- Discord Community: https://discord.gg/secure-node-auth
