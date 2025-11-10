# Headless Apps Guide - Part 3
## Advanced Patterns, Mobile App, and Best Practices

---

## Advanced Patterns

### 10. Database Transactions for Complex Operations

When operations involve multiple tables, use transactions to ensure data consistency.

#### Example: Transfer Between Accounts

```javascript
// src/routes/transfers.js
const express = require('express');
const router = express.Router();

router.post('/transfer', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { fromAccountId, toAccountId, amount, description } = req.body;
    const pool = req.app.get('dbPool');
    
    if (!fromAccountId || !toAccountId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be positive'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Verify both accounts belong to user
      const [fromAccount] = await connection.execute(
        'SELECT id, balance FROM accounts WHERE id = ? AND userId = ? FOR UPDATE',
        [fromAccountId, userId]
      );
      
      const [toAccount] = await connection.execute(
        'SELECT id, balance FROM accounts WHERE id = ? AND userId = ? FOR UPDATE',
        [toAccountId, userId]
      );
      
      if (fromAccount.length === 0 || toAccount.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          error: 'One or both accounts not found'
        });
      }
      
      // Check sufficient balance
      if (parseFloat(fromAccount[0].balance) < parseFloat(amount)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance'
        });
      }
      
      // Create transfer category if not exists
      const [transferCategory] = await connection.execute(
        `INSERT IGNORE INTO categories (userId, name, type) VALUES (?, 'Transfer', 'expense')`,
        [userId]
      );
      
      const [categoryResult] = await connection.execute(
        `SELECT id FROM categories WHERE userId = ? AND name = 'Transfer' LIMIT 1`,
        [userId]
      );
      
      const categoryId = categoryResult[0].id;
      
      // Deduct from source account
      await connection.execute(
        'UPDATE accounts SET balance = balance - ? WHERE id = ?',
        [amount, fromAccountId]
      );
      
      // Add to destination account
      await connection.execute(
        'UPDATE accounts SET balance = balance + ? WHERE id = ?',
        [amount, toAccountId]
      );
      
      // Create outgoing transaction
      const [outgoingResult] = await connection.execute(`
        INSERT INTO transactions 
        (userId, accountId, categoryId, amount, type, description, transactionDate)
        VALUES (?, ?, ?, ?, 'transfer', ?, CURDATE())
      `, [userId, fromAccountId, categoryId, amount, description || `Transfer to account ${toAccountId}`]);
      
      // Create incoming transaction
      await connection.execute(`
        INSERT INTO transactions 
        (userId, accountId, categoryId, amount, type, description, transactionDate)
        VALUES (?, ?, ?, ?, 'transfer', ?, CURDATE())
      `, [userId, toAccountId, categoryId, amount, description || `Transfer from account ${fromAccountId}`]);
      
      await connection.commit();
      
      res.json({
        success: true,
        message: 'Transfer completed successfully',
        data: {
          transactionId: outgoingResult.insertId,
          fromAccountId,
          toAccountId,
          amount: parseFloat(amount)
        }
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'Transfer failed'
    });
  }
});

module.exports = router;
```

### 11. Recurring Transactions (Background Job)

Create a scheduled job to process recurring transactions.

```javascript
// src/jobs/recurringTransactions.js
const cron = require('node-cron');

function startRecurringTransactionJob(pool) {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Processing recurring transactions...');
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Find due recurring transactions
      const [recurring] = await connection.execute(`
        SELECT * FROM recurring_transactions
        WHERE isActive = TRUE AND nextDueDate <= CURDATE()
      `);
      
      console.log(`Found ${recurring.length} due recurring transactions`);
      
      for (const recur of recurring) {
        try {
          // Create transaction
          await connection.execute(`
            INSERT INTO transactions 
            (userId, accountId, categoryId, amount, type, description, transactionDate, isRecurring, recurringId)
            VALUES (?, ?, ?, ?, ?, ?, CURDATE(), TRUE, ?)
          `, [recur.userId, recur.accountId, recur.categoryId, recur.amount, 
              recur.type, recur.description, recur.id]);
          
          // Update account balance
          const balanceChange = recur.type === 'income' ? recur.amount : -recur.amount;
          await connection.execute(
            'UPDATE accounts SET balance = balance + ? WHERE id = ?',
            [balanceChange, recur.accountId]
          );
          
          // Calculate next due date
          let nextDue = new Date(recur.nextDueDate);
          
          switch (recur.frequency) {
            case 'daily':
              nextDue.setDate(nextDue.getDate() + 1);
              break;
            case 'weekly':
              nextDue.setDate(nextDue.getDate() + 7);
              break;
            case 'biweekly':
              nextDue.setDate(nextDue.getDate() + 14);
              break;
            case 'monthly':
              nextDue.setMonth(nextDue.getMonth() + 1);
              break;
            case 'yearly':
              nextDue.setFullYear(nextDue.getFullYear() + 1);
              break;
          }
          
          // Check if end date reached
          if (recur.endDate && nextDue > new Date(recur.endDate)) {
            await connection.execute(
              'UPDATE recurring_transactions SET isActive = FALSE WHERE id = ?',
              [recur.id]
            );
          } else {
            await connection.execute(
              'UPDATE recurring_transactions SET nextDueDate = ? WHERE id = ?',
              [nextDue.toISOString().split('T')[0], recur.id]
            );
          }
          
          console.log(`Processed recurring transaction ${recur.id}`);
          
        } catch (error) {
          console.error(`Failed to process recurring transaction ${recur.id}:`, error);
        }
      }
      
      await connection.commit();
      console.log('Recurring transactions processed successfully');
      
    } catch (error) {
      await connection.rollback();
      console.error('Recurring transaction job failed:', error);
    } finally {
      connection.release();
    }
  });
  
  console.log('Recurring transaction job scheduled (runs daily at midnight)');
}

module.exports = startRecurringTransactionJob;
```

Add to main server file:
```javascript
// src/index.js
const startRecurringTransactionJob = require('./jobs/recurringTransactions');

// After initializing auth
startRecurringTransactionJob(appPool);
```

### 12. Budget Alerts (Real-time Monitoring)

```javascript
// src/utils/budgetAlerts.js
async function checkBudgetAlerts(userId, categoryId, pool) {
  try {
    // Get active budget for category
    const [budgets] = await pool.execute(`
      SELECT 
        b.*,
        c.name as categoryName,
        COALESCE(SUM(t.amount), 0) as spent
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      LEFT JOIN transactions t ON t.categoryId = b.categoryId 
        AND t.userId = b.userId 
        AND t.type = 'expense'
        AND t.transactionDate >= b.startDate
        AND (b.endDate IS NULL OR t.transactionDate <= b.endDate)
      WHERE b.userId = ? AND b.categoryId = ?
      GROUP BY b.id
    `, [userId, categoryId]);
    
    if (budgets.length === 0) return null;
    
    const budget = budgets[0];
    const percentage = (parseFloat(budget.spent) / parseFloat(budget.amount)) * 100;
    
    // Check if alert threshold reached
    if (percentage >= budget.alertThreshold && percentage < 100) {
      return {
        type: 'warning',
        message: `You've spent ${percentage.toFixed(1)}% of your ${budget.categoryName} budget`,
        budget: {
          category: budget.categoryName,
          spent: parseFloat(budget.spent),
          amount: parseFloat(budget.amount),
          percentage: percentage.toFixed(1),
          remaining: parseFloat(budget.amount) - parseFloat(budget.spent)
        }
      };
    }
    
    // Check if budget exceeded
    if (percentage >= 100) {
      return {
        type: 'exceeded',
        message: `You've exceeded your ${budget.categoryName} budget by ${((percentage - 100)).toFixed(1)}%`,
        budget: {
          category: budget.categoryName,
          spent: parseFloat(budget.spent),
          amount: parseFloat(budget.amount),
          percentage: percentage.toFixed(1),
          over: parseFloat(budget.spent) - parseFloat(budget.amount)
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Budget alert check failed:', error);
    return null;
  }
}

module.exports = { checkBudgetAlerts };
```

Use in transaction creation:
```javascript
// In transaction POST route, after creating transaction
const { checkBudgetAlerts } = require('../utils/budgetAlerts');

// ... after transaction created ...

// Check budget alerts
const alert = await checkBudgetAlerts(userId, categoryId, pool);
if (alert) {
  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: newTransaction[0],
    budgetAlert: alert // Include alert in response
  });
} else {
  res.status(201).json({
    success: true,
    message: 'Transaction created successfully',
    data: newTransaction[0]
  });
}
```

---

## Mobile App Integration (React Native)

### 13. React Native Setup

```bash
npx react-native init ExpenseTrackerMobile
cd ExpenseTrackerMobile
npm install axios @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
```

### 14. API Service (src/services/api.js)

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://your-api-url.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        await AsyncStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        // Navigate to login screen
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, tokens } = response.data.data;
    
    await AsyncStorage.multiSet([
      ['accessToken', tokens.accessToken],
      ['refreshToken', tokens.refreshToken],
      ['user', JSON.stringify(user)]
    ]);
    
    return response.data;
  },
  
  logout: async () => {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    await api.post('/auth/logout', { refreshToken });
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
  }
};

// Transaction API (same as web)
export const transactionAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },
  // ... other methods
};

export default api;
```

### 15. Auth Context for Mobile (src/context/AuthContext.js)

```javascript
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const accessToken = await AsyncStorage.getItem('accessToken');

      if (storedUser && accessToken) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    setUser(response.data.user);
    return response;
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## Best Practices

### 16. Security Best Practices

#### Environment Variables
```bash
# Never commit these to version control!
NODE_ENV=production
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=strong-password-here
JWT_ACCESS_SECRET=minimum-32-characters-random-string-abc123xyz789
JWT_REFRESH_SECRET=different-32-characters-random-string-def456uvw012
```

#### HTTPS Enforcement
```javascript
// In production, force HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

#### Rate Limiting Per Route
```javascript
const rateLimit = require('express-rate-limit');

// Stricter rate limit for transaction creation
const transactionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  message: 'Too many transactions created, please try again later'
});

router.post('/', transactionLimiter, async (req, res) => {
  // Transaction creation logic
});
```

### 17. Error Handling Middleware

```javascript
// src/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    userId: req.user?.userId
  });

  // Database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'Referenced record not found'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
}

module.exports = errorHandler;
```

### 18. Input Validation Utility

```javascript
// src/utils/validation.js
const validator = require('validator');

function validateTransaction(data) {
  const errors = [];

  if (!data.accountId || !Number.isInteger(data.accountId)) {
    errors.push('Valid accountId is required');
  }

  if (!data.categoryId || !Number.isInteger(data.categoryId)) {
    errors.push('Valid categoryId is required');
  }

  if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
    errors.push('Valid positive amount is required');
  }

  if (!data.type || !['income', 'expense', 'transfer'].includes(data.type)) {
    errors.push('Type must be income, expense, or transfer');
  }

  if (!data.transactionDate || !validator.isDate(data.transactionDate)) {
    errors.push('Valid transaction date is required (YYYY-MM-DD)');
  }

  if (data.description && data.description.length > 500) {
    errors.push('Description must be less than 500 characters');
  }

  return errors;
}

function validateBudget(data) {
  const errors = [];

  if (!data.categoryId || !Number.isInteger(data.categoryId)) {
    errors.push('Valid categoryId is required');
  }

  if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
    errors.push('Valid positive amount is required');
  }

  if (!data.period || !['daily', 'weekly', 'monthly', 'yearly'].includes(data.period)) {
    errors.push('Period must be daily, weekly, monthly, or yearly');
  }

  if (!data.startDate || !validator.isDate(data.startDate)) {
    errors.push('Valid start date is required (YYYY-MM-DD)');
  }

  if (data.endDate && !validator.isDate(data.endDate)) {
    errors.push('End date must be a valid date (YYYY-MM-DD)');
  }

  if (data.alertThreshold && (data.alertThreshold < 0 || data.alertThreshold > 100)) {
    errors.push('Alert threshold must be between 0 and 100');
  }

  return errors;
}

module.exports = {
  validateTransaction,
  validateBudget
};
```

### 19. Database Backup Script

```javascript
// scripts/backup.js
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const backupDir = path.join(__dirname, '../backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

const command = `mysqldump -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${backupFile}`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Backup failed:', error);
    return;
  }
  
  console.log(`✓ Database backed up to: ${backupFile}`);
  
  // Delete backups older than 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  fs.readdir(backupDir, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtimeMs < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`✓ Deleted old backup: ${file}`);
      }
    });
  });
});
```

Add to package.json:
```json
{
  "scripts": {
    "backup": "node scripts/backup.js"
  }
}
```

### 20. Performance Monitoring

```javascript
// src/middleware/performanceMonitor.js
function performanceMonitor(req, res, next) {
  const start = Date.now();
  
  // Capture response
  const originalSend = res.json;
  
  res.json = function(data) {
    const duration = Date.now() - start;
    
    // Log slow requests (>1 second)
    if (duration > 1000) {
      console.warn('Slow request:', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        userId: req.user?.userId
      });
    }
    
    // Add performance header
    res.set('X-Response-Time', `${duration}ms`);
    
    return originalSend.call(this, data);
  };
  
  next();
}

module.exports = performanceMonitor;
```

---

## Deployment Checklist

### Production Environment

- [ ] Environment variables configured (DB, JWT secrets)
- [ ] HTTPS enabled and enforced
- [ ] Database backups scheduled (daily)
- [ ] Security headers configured (Helmet)
- [ ] CORS properly configured (specific origins)
- [ ] Rate limiting enabled on all routes
- [ ] Error logging service configured (Sentry, LogRocket)
- [ ] Database connection pooling optimized
- [ ] Audit logging to external service
- [ ] Monitoring and alerting setup (CloudWatch, Datadog)
- [ ] Load balancer configured (if multiple instances)
- [ ] Database read replicas (if high traffic)
- [ ] CDN for static assets (if any)
- [ ] Regular security updates scheduled
- [ ] Penetration testing completed
- [ ] Documentation updated
- [ ] Disaster recovery plan documented

---

## Summary

You now have a complete guide for building headless applications with SecureNodeAuth! The income/expense tracker example demonstrates:

✅ **Authentication Layer**: SecureNodeAuth handles users, sessions, tokens  
✅ **Complex Database Schema**: Multiple related tables with foreign keys  
✅ **RESTful API**: Full CRUD operations for all resources  
✅ **Data Isolation**: Each user only accesses their own data  
✅ **Transaction Safety**: Database transactions for complex operations  
✅ **Real-time Features**: Budget alerts, recurring transactions  
✅ **Multi-platform**: Web (React) and Mobile (React Native)  
✅ **Production Ready**: Security, monitoring, backups, error handling  

**Key Takeaway**: SecureNodeAuth provides the authentication foundation, allowing you to focus on building your application's unique features and business logic!
