# PostgreSQL Integration Guide

Complete guide for using SecureNodeAuth with PostgreSQL database.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install secure-node-auth pg
```

**Note**: The `pg` package is an optional dependency. It's only required if you want to use PostgreSQL.

### 2. Basic PostgreSQL Setup

```javascript
const SecureNodeAuth = require('secure-node-auth');

const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres', // or 'postgresql' or 'pg'
    host: 'localhost',
    user: 'postgres',
    password: 'your_password',
    database: 'myapp',
    port: 5432, // Optional, defaults to 5432 for PostgreSQL
  },
});

await auth.init(); // Auto-creates tables!
```

That's it! You now have a complete authentication system using PostgreSQL! 🎉

---

## 📋 Configuration Options

### Database Connection

```javascript
const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres', // Database type
    host: 'localhost', // Database host
    user: 'postgres', // Database user
    password: 'your_password', // Database password
    database: 'myapp', // Database name
    port: 5432, // PostgreSQL port (default: 5432)

    // PostgreSQL-specific options
    ssl: false, // Enable SSL (set to true for production)
    connectionLimit: 10, // Max number of connections in pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait for a connection
  },
});
```

### Environment Variables

Create a `.env` file:

```bash
DB_TYPE=postgres
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=myapp
DB_PORT=5432

JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
```

Then use:

```javascript
require('dotenv').config();
const auth = new SecureNodeAuth();
await auth.init();
```

---

## 💡 Complete Express Example

```javascript
require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

// Initialize with PostgreSQL
const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'myapp',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
  },
});

// Initialize database
auth
  .init()
  .then(() => {
    console.log('✅ PostgreSQL connected and tables created');

    // Mount auth routes
    app.use('/auth', auth.router());

    // Protected route
    app.get('/api/profile', auth.middleware(), async (req, res) => {
      const user = await auth.getUserById(req.user.userId);
      res.json({ user });
    });

    app.listen(3000, () => {
      console.log('🚀 Server running on http://localhost:3000');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize:', error);
    process.exit(1);
  });
```

---

## ⚡ Complete Fastify Example

```javascript
const fastify = require('fastify')({ logger: true });
const SecureNodeAuth = require('secure-node-auth');
const secureNodeAuthPlugin = require('secure-node-auth/src/middleware/FastifyPlugin');

async function start() {
  // Initialize with PostgreSQL
  const auth = new SecureNodeAuth({
    connection: {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'myapp',
    },
  });

  await auth.init();
  console.log('✅ PostgreSQL connected and tables created');

  // Register auth plugin
  await fastify.register(secureNodeAuthPlugin, {
    authInstance: auth,
    routeOptions: { prefix: '/auth' },
  });

  // Protected route
  fastify.get(
    '/api/profile',
    {
      preHandler: fastify.authenticate,
    },
    async (request, reply) => {
      const user = await auth.getUserById(request.user.userId);
      return { user };
    }
  );

  await fastify.listen({ port: 3000 });
  console.log('🚀 Server running on http://localhost:3000');
}

start().catch((error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});
```

---

## 🔧 PostgreSQL-Specific Features

### 1. Auto-Create Database

Unlike MySQL which requires the database to exist, you can create it first:

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE myapp;
CREATE USER myapp_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_user;
```

### 2. SSL Connection (Production)

```javascript
const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres',
    host: 'your-postgres-host.com',
    user: 'postgres',
    password: 'your_password',
    database: 'myapp',
    ssl: {
      rejectUnauthorized: false, // Set to true with proper CA in production
    },
  },
});
```

### 3. Connection Pooling

PostgreSQL uses connection pooling by default:

```javascript
const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres',
    host: 'localhost',
    user: 'postgres',
    password: 'your_password',
    database: 'myapp',
    connectionLimit: 20, // Max connections
    idleTimeoutMillis: 30000, // 30 seconds
    connectionTimeoutMillis: 2000, // 2 seconds
  },
});
```

---

## 📊 Database Schema

SecureNodeAuth automatically creates these PostgreSQL tables:

### `secure_auth_users` Table

```sql
CREATE TABLE IF NOT EXISTS "secure_auth_users" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  "firstName" VARCHAR(100),
  "lastName" VARCHAR(100),
  "emailVerified" BOOLEAN DEFAULT FALSE,
  "emailVerificationToken" VARCHAR(255),
  "resetPasswordToken" VARCHAR(255),
  "resetPasswordExpires" BIGINT,
  "isActive" BOOLEAN DEFAULT TRUE,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for auto-updating updatedAt
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON "secure_auth_users"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### `secure_auth_refresh_tokens` Table

```sql
CREATE TABLE IF NOT EXISTS "secure_auth_refresh_tokens" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  token TEXT NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  "expiresAt" BIGINT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "secure_auth_users"(id) ON DELETE CASCADE
);
```

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_email ON "secure_auth_users"(email);
CREATE INDEX IF NOT EXISTS idx_user_tokens ON "secure_auth_refresh_tokens"("userId", revoked);
CREATE INDEX IF NOT EXISTS idx_token_expires ON "secure_auth_refresh_tokens"("expiresAt");
```

---

## 🎨 Custom Fields (PostgreSQL)

```javascript
const auth = new SecureNodeAuth({
  connection: {
    type: 'postgres',
    host: 'localhost',
    user: 'postgres',
    password: 'your_password',
    database: 'myapp',
  },
});

// Add custom fields BEFORE init()
auth.addField({
  name: 'phoneNumber',
  type: 'VARCHAR(20)',
  required: false,
  unique: true,
});

auth.addField({
  name: 'age',
  type: 'INTEGER',
  required: false,
});

auth.addField({
  name: 'accountBalance',
  type: 'DECIMAL(10,2)',
  defaultValue: 0.0,
});

auth.addField({
  name: 'isVerified',
  type: 'BOOLEAN',
  defaultValue: false,
});

await auth.init();

// Register with custom fields
await auth.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  phoneNumber: '+1234567890',
  age: 25,
  accountBalance: 100.5,
  isVerified: true,
});
```

---

## 🔄 MySQL vs PostgreSQL Differences

| Feature            | MySQL            | PostgreSQL                       |
| ------------------ | ---------------- | -------------------------------- |
| **Type**           | `type: 'mysql'`  | `type: 'postgres'`               |
| **Default Port**   | 3306             | 5432                             |
| **Auto-increment** | `AUTO_INCREMENT` | `SERIAL`                         |
| **Quotes**         | Backticks \`\`   | Double quotes ""                 |
| **Placeholders**   | `?`              | `$1, $2, $3`                     |
| **Boolean**        | `TINYINT(1)`     | `BOOLEAN`                        |
| **Text Types**     | `TEXT`           | `TEXT`                           |
| **Timestamp**      | `TIMESTAMP`      | `TIMESTAMP`                      |
| **ENUM**           | `ENUM('a','b')`  | `VARCHAR` (app-level validation) |

**Good News**: All differences are handled automatically! Just set `type: 'postgres'` and everything works! 🎉

---

## 🔌 Direct Database Access

```javascript
// Get PostgreSQL pool for custom queries
const pool = auth.getPool();

// Example: Custom query with PostgreSQL syntax
const result = await pool.query(
  'SELECT COUNT(*) as total FROM "secure_auth_users" WHERE "isActive" = $1',
  [true]
);

console.log('Active users:', result.rows[0].total);

// Using parameterized queries (PostgreSQL uses $1, $2, etc.)
const users = await pool.query(
  'SELECT id, email, "firstName", "lastName" FROM "secure_auth_users" WHERE "emailVerified" = $1 LIMIT $2',
  [true, 10]
);

users.rows.forEach((user) => {
  console.log(user.email);
});
```

---

## 🐳 Docker Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    environment:
      DB_TYPE: postgres
      DB_HOST: postgres
      DB_USER: postgres
      DB_PASSWORD: your_password
      DB_NAME: myapp
      JWT_ACCESS_SECRET: your_secret
      JWT_REFRESH_SECRET: your_refresh_secret
    ports:
      - '3000:3000'
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Start with Docker

```bash
docker-compose up -d
```

---

## 🧪 Testing

```javascript
const SecureNodeAuth = require('secure-node-auth');

describe('PostgreSQL Authentication', () => {
  let auth;

  beforeAll(async () => {
    auth = new SecureNodeAuth({
      connection: {
        type: 'postgres',
        host: 'localhost',
        user: 'postgres',
        password: 'test_password',
        database: 'test_db',
      },
    });
    await auth.init();
  });

  afterAll(async () => {
    await auth.close();
  });

  test('Register user', async () => {
    const result = await auth.register({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
    expect(result.tokens.accessToken).toBeDefined();
  });
});
```

---

## ⚠️ Migration from MySQL

Already using MySQL? Here's how to migrate to PostgreSQL:

### 1. Export MySQL Data

```bash
mysqldump -u root -p myapp > backup.sql
```

### 2. Convert Schema

Use a tool like [pgloader](https://pgloader.io/) or manually convert:

```bash
# Install pgloader
brew install pgloader  # macOS
apt-get install pgloader  # Ubuntu

# Migrate
pgloader mysql://user:pass@localhost/mydb postgresql://user:pass@localhost/mydb
```

### 3. Update Configuration

```javascript
// Change from MySQL
connection: {
  type: 'mysql',  // ❌ Old
  // ...
}

// To PostgreSQL
connection: {
  type: 'postgres',  // ✅ New
  // ...
}
```

### 4. Test Everything

```bash
npm test
```

---

## 🔒 Security Best Practices

1. **Use SSL in Production**

   ```javascript
   ssl: {
     rejectUnauthorized: true;
   }
   ```

2. **Use Environment Variables**

   ```javascript
   password: process.env.DB_PASSWORD;
   ```

3. **Limit Connections**

   ```javascript
   connectionLimit: 10;
   ```

4. **Use Strong Passwords**
   - Database password should be 16+ characters
   - Use a password manager

5. **Regular Backups**
   ```bash
   pg_dump myapp > backup_$(date +%Y%m%d).sql
   ```

---

## 📚 Additional Resources

- [PostgreSQL Official Docs](https://www.postgresql.org/docs/)
- [node-postgres (pg) Documentation](https://node-postgres.com/)
- [PostgreSQL vs MySQL](https://www.postgresql.org/about/)
- [SecureNodeAuth Main Docs](../README.md)
- [Fastify Guide](FASTIFY_GUIDE.md)

---

## 🆚 Why Choose PostgreSQL?

✅ **Advanced Features** - JSON support, full-text search, custom types  
✅ **ACID Compliant** - Strong data integrity guarantees  
✅ **Open Source** - Truly free with no commercial restrictions  
✅ **Extensible** - Custom functions, operators, and data types  
✅ **Standards Compliant** - Better SQL standards support  
✅ **Great for Complex Queries** - Superior query optimizer

**Both MySQL and PostgreSQL are excellent choices. Pick based on your needs!** 🎯

---

## 🤝 Support

Having issues with PostgreSQL integration?

- 📖 [GitHub Issues](https://github.com/HimasRafeek/secure-node-auth/issues)
- 💬 [Discussions](https://github.com/HimasRafeek/secure-node-auth/discussions)
- 📧 Email: contact@himasrafeek.com

---

**Built with ❤️ for developers who love choice and flexibility!**
