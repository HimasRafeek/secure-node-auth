# Building Headless Apps with SecureNodeAuth

## Complete Guide: Income/Expense Tracker Example

This guide demonstrates how to use SecureNodeAuth as a secure authentication layer for complex headless applications with custom database schemas.

---

## Architecture Overview

### Headless Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Frontend App   │ ◄─────► │  Node.js API    │ ◄─────► │  MySQL Database │
│  (React/Vue)    │  REST   │  + SecureNode   │   SQL   │  (Your Schema)  │
│  Mobile App     │  JSON   │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### Key Concepts

- **SecureNodeAuth**: Handles authentication only (users, tokens, login)
- **Your Tables**: Store application data (transactions, categories, budgets)
- **User Association**: Link your data to authenticated users via `userId`

---

## Database Schema Design

### Income/Expense Tracker Schema

```sql
-- SecureNodeAuth creates these tables automatically:
-- secure_auth_users (id, email, password, firstName, lastName, ...)
-- secure_auth_refresh_tokens
-- secure_auth_login_attempts

-- YOUR APPLICATION TABLES:

-- Categories (Income/Expense types)
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  color VARCHAR(7) DEFAULT '#000000',
  icon VARCHAR(50),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  INDEX idx_userId_type (userId, type),
  INDEX idx_active (userId, isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Accounts (Bank accounts, wallets, credit cards)
CREATE TABLE accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('checking', 'savings', 'credit_card', 'cash', 'investment') NOT NULL,
  balance DECIMAL(15, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  INDEX idx_userId_active (userId, isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transactions (Income/Expense records)
CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  accountId INT NOT NULL,
  categoryId INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  type ENUM('income', 'expense', 'transfer') NOT NULL,
  description TEXT,
  transactionDate DATE NOT NULL,
  tags JSON,
  receiptUrl VARCHAR(255),
  isRecurring BOOLEAN DEFAULT FALSE,
  recurringId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_userId_date (userId, transactionDate),
  INDEX idx_userId_type (userId, type),
  INDEX idx_account (accountId),
  INDEX idx_category (categoryId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Budgets (Monthly spending limits)
CREATE TABLE budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  categoryId INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  period ENUM('daily', 'weekly', 'monthly', 'yearly') DEFAULT 'monthly',
  startDate DATE NOT NULL,
  endDate DATE,
  alertThreshold INT DEFAULT 80, -- Alert at 80% of budget
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_userId_period (userId, period),
  UNIQUE KEY unique_user_category_period (userId, categoryId, period, startDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recurring Transactions Template
CREATE TABLE recurring_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  accountId INT NOT NULL,
  categoryId INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  type ENUM('income', 'expense') NOT NULL,
  description TEXT,
  frequency ENUM('daily', 'weekly', 'biweekly', 'monthly', 'yearly') NOT NULL,
  startDate DATE NOT NULL,
  endDate DATE,
  nextDueDate DATE NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_userId_active (userId, isActive),
  INDEX idx_nextDue (nextDueDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User Preferences
CREATE TABLE user_preferences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL UNIQUE,
  defaultCurrency VARCHAR(3) DEFAULT 'USD',
  defaultAccount INT,
  weekStartDay ENUM('sunday', 'monday') DEFAULT 'sunday',
  dateFormat VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  timezone VARCHAR(50) DEFAULT 'UTC',
  notifications JSON, -- {email: true, push: false, ...}
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## Backend Setup

### Project Structure

```
expense-tracker-api/
├── src/
│   ├── index.js                 # Main server file
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── middleware/
│   │   └── auth.js              # SecureNodeAuth middleware
│   ├── models/
│   │   ├── Transaction.js       # Transaction model
│   │   ├── Category.js          # Category model
│   │   ├── Account.js           # Account model
│   │   └── Budget.js            # Budget model
│   ├── routes/
│   │   ├── auth.js              # Auth routes (SecureNodeAuth)
│   │   ├── transactions.js      # Transaction endpoints
│   │   ├── categories.js        # Category endpoints
│   │   ├── accounts.js          # Account endpoints
│   │   └── budgets.js           # Budget endpoints
│   └── utils/
│       ├── database.js          # Database utilities
│       └── validation.js        # Input validation
├── .env
├── package.json
└── README.md
```

### 1. Install Dependencies

```bash
npm init -y
npm install express dotenv cors mysql2 secure-node-auth
npm install --save-dev nodemon
```

### 2. Environment Configuration (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=expense_tracker

# JWT Secrets (Generate strong secrets!)
JWT_ACCESS_SECRET=your_super_secret_access_key_min_32_chars_long_12345678
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars_different_87654321

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Main Server File (src/index.js)

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SecureNodeAuth = require('secure-node-auth');
const mysql = require('mysql2/promise');

// Import routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const accountRoutes = require('./routes/accounts');
const budgetRoutes = require('./routes/budgets');

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database pool for application queries (separate from SecureNodeAuth)
const appPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Make pool available to routes
app.set('dbPool', appPool);

// Initialize SecureNodeAuth
const auth = new SecureNodeAuth({
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutTime: parseInt(process.env.LOCKOUT_TIME) || 900000,
  },
  // Custom audit logger
  auditLogger: (event, data) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[AUDIT] ${timestamp} - ${event}`,
      JSON.stringify({
        ...data,
        environment: process.env.NODE_ENV,
      })
    );

    // In production, send to logging service (Winston, CloudWatch, etc.)
  },
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize SecureNodeAuth (creates auth tables)
    await auth.init();
    console.log('✓ SecureNodeAuth initialized');

    // Create application tables
    await createApplicationTables(appPool);
    console.log('✓ Application tables created');

    // Make auth instance available to routes
    app.set('auth', auth);

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });
    });

    // Mount routes
    app.use('/api/auth', authRoutes(auth));
    app.use('/api/transactions', auth.middleware(), transactionRoutes);
    app.use('/api/categories', auth.middleware(), categoryRoutes);
    app.use('/api/accounts', auth.middleware(), accountRoutes);
    app.use('/api/budgets', auth.middleware(), budgetRoutes);

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
      });
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
      console.log(`🔒 Auth: http://localhost:${PORT}/api/auth`);
      console.log(`💰 Transactions: http://localhost:${PORT}/api/transactions`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Create application tables
async function createApplicationTables(pool) {
  const connection = await pool.getConnection();

  try {
    // Categories table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        type ENUM('income', 'expense') NOT NULL,
        color VARCHAR(7) DEFAULT '#000000',
        icon VARCHAR(50),
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
        INDEX idx_userId_type (userId, type),
        INDEX idx_active (userId, isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Accounts table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        type ENUM('checking', 'savings', 'credit_card', 'cash', 'investment') NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'USD',
        isActive BOOLEAN DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
        INDEX idx_userId_active (userId, isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Transactions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        accountId INT NOT NULL,
        categoryId INT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        type ENUM('income', 'expense', 'transfer') NOT NULL,
        description TEXT,
        transactionDate DATE NOT NULL,
        tags JSON,
        receiptUrl VARCHAR(255),
        isRecurring BOOLEAN DEFAULT FALSE,
        recurringId INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
        FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT,
        INDEX idx_userId_date (userId, transactionDate),
        INDEX idx_userId_type (userId, type),
        INDEX idx_account (accountId),
        INDEX idx_category (categoryId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Budgets table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        categoryId INT NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        period ENUM('daily', 'weekly', 'monthly', 'yearly') DEFAULT 'monthly',
        startDate DATE NOT NULL,
        endDate DATE,
        alertThreshold INT DEFAULT 80,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE,
        INDEX idx_userId_period (userId, period),
        UNIQUE KEY unique_user_category_period (userId, categoryId, period, startDate)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // User preferences table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL UNIQUE,
        defaultCurrency VARCHAR(3) DEFAULT 'USD',
        defaultAccount INT,
        weekStartDay ENUM('sunday', 'monday') DEFAULT 'sunday',
        dateFormat VARCHAR(20) DEFAULT 'MM/DD/YYYY',
        timezone VARCHAR(50) DEFAULT 'UTC',
        notifications JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } finally {
    connection.release();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, closing server gracefully...');
  await auth.close();
  await appPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, closing server gracefully...');
  await auth.close();
  await appPool.end();
  process.exit(0);
});

startServer();
```

---

## API Endpoints

### 4. Auth Routes (src/routes/auth.js)

```javascript
const express = require('express');

module.exports = function (auth) {
  const router = express.Router();

  // Use SecureNodeAuth's built-in routes
  router.use('/', auth.router());

  // Add custom post-registration logic
  router.post('/register-complete', auth.middleware(), async (req, res) => {
    try {
      const userId = req.user.userId;
      const pool = req.app.get('dbPool');

      // Create default categories for new user
      await pool.execute(
        `
        INSERT INTO categories (userId, name, type, color, icon) VALUES
        (?, 'Salary', 'income', '#4CAF50', 'money'),
        (?, 'Freelance', 'income', '#8BC34A', 'briefcase'),
        (?, 'Food & Dining', 'expense', '#FF5722', 'utensils'),
        (?, 'Transportation', 'expense', '#2196F3', 'car'),
        (?, 'Shopping', 'expense', '#9C27B0', 'shopping-cart'),
        (?, 'Bills & Utilities', 'expense', '#FF9800', 'file-invoice'),
        (?, 'Healthcare', 'expense', '#F44336', 'heartbeat'),
        (?, 'Entertainment', 'expense', '#E91E63', 'film')
      `,
        [userId, userId, userId, userId, userId, userId, userId, userId]
      );

      // Create default account
      const [result] = await pool.execute(
        'INSERT INTO accounts (userId, name, type, balance) VALUES (?, ?, ?, ?)',
        [userId, 'Main Account', 'checking', 0]
      );

      // Create user preferences
      await pool.execute(
        `
        INSERT INTO user_preferences (userId, defaultAccount) VALUES (?, ?)
      `,
        [userId, result.insertId]
      );

      res.json({
        success: true,
        message: 'Account setup completed',
      });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete account setup',
      });
    }
  });

  return router;
};
```

### 5. Transaction Routes (src/routes/transactions.js)

```javascript
const express = require('express');
const router = express.Router();

// Get all transactions for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = req.app.get('dbPool');

    const { startDate, endDate, type, categoryId, accountId, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        t.id,
        t.amount,
        t.type,
        t.description,
        t.transactionDate,
        t.tags,
        t.receiptUrl,
        t.createdAt,
        a.name AS accountName,
        a.type AS accountType,
        c.name AS categoryName,
        c.color AS categoryColor,
        c.icon AS categoryIcon
      FROM transactions t
      JOIN accounts a ON t.accountId = a.id
      JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ?
    `;

    const params = [userId];

    // Add filters
    if (startDate) {
      query += ' AND t.transactionDate >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND t.transactionDate <= ?';
      params.push(endDate);
    }
    if (type) {
      query += ' AND t.type = ?';
      params.push(type);
    }
    if (categoryId) {
      query += ' AND t.categoryId = ?';
      params.push(categoryId);
    }
    if (accountId) {
      query += ' AND t.accountId = ?';
      params.push(accountId);
    }

    query += ' ORDER BY t.transactionDate DESC, t.createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [transactions] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM transactions WHERE userId = ?';
    const countParams = [userId];

    if (startDate) {
      countQuery += ' AND transactionDate >= ?';
      countParams.push(startDate);
    }
    if (endDate) {
      countQuery += ' AND transactionDate <= ?';
      countParams.push(endDate);
    }
    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }
    if (categoryId) {
      countQuery += ' AND categoryId = ?';
      countParams.push(categoryId);
    }
    if (accountId) {
      countQuery += ' AND accountId = ?';
      countParams.push(accountId);
    }

    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
    });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = req.app.get('dbPool');

    const [transactions] = await pool.execute(
      `
      SELECT 
        t.*,
        a.name AS accountName,
        c.name AS categoryName,
        c.color AS categoryColor
      FROM transactions t
      JOIN accounts a ON t.accountId = a.id
      JOIN categories c ON t.categoryId = c.id
      WHERE t.id = ? AND t.userId = ?
    `,
      [id, userId]
    );

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transactions[0],
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction',
    });
  }
});

// Create transaction
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId, categoryId, amount, type, description, transactionDate, tags } = req.body;
    const pool = req.app.get('dbPool');

    // Validation
    if (!accountId || !categoryId || !amount || !type || !transactionDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    // Verify account belongs to user
    const [accounts] = await pool.execute('SELECT id FROM accounts WHERE id = ? AND userId = ?', [
      accountId,
      userId,
    ]);

    if (accounts.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Account not found or access denied',
      });
    }

    // Verify category belongs to user
    const [categories] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND userId = ?',
      [categoryId, userId]
    );

    if (categories.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Category not found or access denied',
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Insert transaction
      const [result] = await connection.execute(
        `
        INSERT INTO transactions 
        (userId, accountId, categoryId, amount, type, description, transactionDate, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          userId,
          accountId,
          categoryId,
          amount,
          type,
          description,
          transactionDate,
          tags ? JSON.stringify(tags) : null,
        ]
      );

      // Update account balance
      const balanceChange = type === 'income' ? amount : -amount;
      await connection.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [
        balanceChange,
        accountId,
      ]);

      await connection.commit();

      // Fetch created transaction with details
      const [newTransaction] = await pool.execute(
        `
        SELECT 
          t.*,
          a.name AS accountName,
          c.name AS categoryName,
          c.color AS categoryColor
        FROM transactions t
        JOIN accounts a ON t.accountId = a.id
        JOIN categories c ON t.categoryId = c.id
        WHERE t.id = ?
      `,
        [result.insertId]
      );

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: newTransaction[0],
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create transaction',
    });
  }
});

// Update transaction
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { accountId, categoryId, amount, type, description, transactionDate, tags } = req.body;
    const pool = req.app.get('dbPool');

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get old transaction
      const [oldTransaction] = await connection.execute(
        'SELECT * FROM transactions WHERE id = ? AND userId = ?',
        [id, userId]
      );

      if (oldTransaction.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      const old = oldTransaction[0];

      // Revert old balance change
      const oldBalanceChange = old.type === 'income' ? -old.amount : old.amount;
      await connection.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [
        oldBalanceChange,
        old.accountId,
      ]);

      // Update transaction
      await connection.execute(
        `
        UPDATE transactions 
        SET accountId = ?, categoryId = ?, amount = ?, type = ?, 
            description = ?, transactionDate = ?, tags = ?
        WHERE id = ? AND userId = ?
      `,
        [
          accountId,
          categoryId,
          amount,
          type,
          description,
          transactionDate,
          tags ? JSON.stringify(tags) : null,
          id,
          userId,
        ]
      );

      // Apply new balance change
      const newBalanceChange = type === 'income' ? amount : -amount;
      await connection.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [
        newBalanceChange,
        accountId,
      ]);

      await connection.commit();

      // Fetch updated transaction
      const [updated] = await pool.execute(
        `
        SELECT 
          t.*,
          a.name AS accountName,
          c.name AS categoryName,
          c.color AS categoryColor
        FROM transactions t
        JOIN accounts a ON t.accountId = a.id
        JOIN categories c ON t.categoryId = c.id
        WHERE t.id = ?
      `,
        [id]
      );

      res.json({
        success: true,
        message: 'Transaction updated successfully',
        data: updated[0],
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update transaction',
    });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = req.app.get('dbPool');

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Get transaction
      const [transactions] = await connection.execute(
        'SELECT * FROM transactions WHERE id = ? AND userId = ?',
        [id, userId]
      );

      if (transactions.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      const transaction = transactions[0];

      // Revert balance change
      const balanceChange =
        transaction.type === 'income' ? -transaction.amount : transaction.amount;
      await connection.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [
        balanceChange,
        transaction.accountId,
      ]);

      // Delete transaction
      await connection.execute('DELETE FROM transactions WHERE id = ? AND userId = ?', [
        id,
        userId,
      ]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Transaction deleted successfully',
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete transaction',
    });
  }
});

// Get transaction summary/statistics
router.get('/summary/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate, period = 'month' } = req.query;
    const pool = req.app.get('dbPool');

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND transactionDate BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (period === 'month') {
      dateFilter =
        'AND YEAR(transactionDate) = YEAR(CURDATE()) AND MONTH(transactionDate) = MONTH(CURDATE())';
    } else if (period === 'year') {
      dateFilter = 'AND YEAR(transactionDate) = YEAR(CURDATE())';
    }

    // Total income and expenses
    const [totals] = await pool.execute(
      `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpenses,
        COUNT(*) as transactionCount
      FROM transactions
      WHERE userId = ? ${dateFilter}
    `,
      params
    );

    // By category
    const [byCategory] = await pool.execute(
      `
      SELECT 
        c.name,
        c.color,
        c.icon,
        t.type,
        SUM(t.amount) as total,
        COUNT(*) as count
      FROM transactions t
      JOIN categories c ON t.categoryId = c.id
      WHERE t.userId = ? ${dateFilter}
      GROUP BY c.id, c.name, c.color, c.icon, t.type
      ORDER BY total DESC
    `,
      params
    );

    // By account
    const [byAccount] = await pool.execute(
      `
      SELECT 
        a.name,
        a.type,
        a.balance,
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as income,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as expenses
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.accountId AND t.userId = ? ${dateFilter}
      WHERE a.userId = ? AND a.isActive = TRUE
      GROUP BY a.id, a.name, a.type, a.balance
    `,
      [...params, userId]
    );

    res.json({
      success: true,
      data: {
        totals: {
          income: parseFloat(totals[0].totalIncome) || 0,
          expenses: parseFloat(totals[0].totalExpenses) || 0,
          balance:
            (parseFloat(totals[0].totalIncome) || 0) - (parseFloat(totals[0].totalExpenses) || 0),
          transactionCount: totals[0].transactionCount,
        },
        byCategory,
        byAccount,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch summary',
    });
  }
});

module.exports = router;
```

Continue in next response...
