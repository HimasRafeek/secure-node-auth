# Headless Apps Guide - Part 2
## Category, Account, and Budget Routes + Frontend Integration

### 6. Category Routes (src/routes/categories.js)

```javascript
const express = require('express');
const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type } = req.query; // Filter by 'income' or 'expense'
    const pool = req.app.get('dbPool');
    
    let query = 'SELECT * FROM categories WHERE userId = ? AND isActive = TRUE';
    const params = [userId];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY name ASC';
    
    const [categories] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

// Create category
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, type, color, icon } = req.body;
    const pool = req.app.get('dbPool');
    
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required'
      });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO categories (userId, name, type, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, name, type, color || '#000000', icon || null]);
    
    const [newCategory] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory[0]
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, type, color, icon } = req.body;
    const pool = req.app.get('dbPool');
    
    const [result] = await pool.execute(`
      UPDATE categories 
      SET name = ?, type = ?, color = ?, icon = ?
      WHERE id = ? AND userId = ?
    `, [name, type, color, icon, id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    const [updated] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Category updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
});

// Delete category (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = req.app.get('dbPool');
    
    // Check if category has transactions
    const [transactions] = await pool.execute(
      'SELECT COUNT(*) as count FROM transactions WHERE categoryId = ? AND userId = ?',
      [id, userId]
    );
    
    if (transactions[0].count > 0) {
      // Soft delete (mark inactive)
      await pool.execute(
        'UPDATE categories SET isActive = FALSE WHERE id = ? AND userId = ?',
        [id, userId]
      );
      
      return res.json({
        success: true,
        message: 'Category deactivated (has existing transactions)'
      });
    }
    
    // Hard delete if no transactions
    const [result] = await pool.execute(
      'DELETE FROM categories WHERE id = ? AND userId = ?',
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category'
    });
  }
});

module.exports = router;
```

### 7. Account Routes (src/routes/accounts.js)

```javascript
const express = require('express');
const router = express.Router();

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = req.app.get('dbPool');
    
    const [accounts] = await pool.execute(`
      SELECT 
        a.*,
        COUNT(t.id) as transactionCount,
        SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as totalExpenses
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.accountId
      WHERE a.userId = ? AND a.isActive = TRUE
      GROUP BY a.id
      ORDER BY a.name ASC
    `, [userId]);
    
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts'
    });
  }
});

// Create account
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, type, balance = 0, currency = 'USD' } = req.body;
    const pool = req.app.get('dbPool');
    
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required'
      });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO accounts (userId, name, type, balance, currency)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, name, type, balance, currency]);
    
    const [newAccount] = await pool.execute(
      'SELECT * FROM accounts WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: newAccount[0]
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account'
    });
  }
});

// Update account
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, type, currency } = req.body;
    const pool = req.app.get('dbPool');
    
    const [result] = await pool.execute(`
      UPDATE accounts 
      SET name = ?, type = ?, currency = ?
      WHERE id = ? AND userId = ?
    `, [name, type, currency, id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    const [updated] = await pool.execute(
      'SELECT * FROM accounts WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Account updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update account'
    });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = req.app.get('dbPool');
    
    // Check if account has transactions
    const [transactions] = await pool.execute(
      'SELECT COUNT(*) as count FROM transactions WHERE accountId = ? AND userId = ?',
      [id, userId]
    );
    
    if (transactions[0].count > 0) {
      // Soft delete
      await pool.execute(
        'UPDATE accounts SET isActive = FALSE WHERE id = ? AND userId = ?',
        [id, userId]
      );
      
      return res.json({
        success: true,
        message: 'Account deactivated (has existing transactions)'
      });
    }
    
    // Hard delete
    const [result] = await pool.execute(
      'DELETE FROM accounts WHERE id = ? AND userId = ?',
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

module.exports = router;
```

### 8. Budget Routes (src/routes/budgets.js)

```javascript
const express = require('express');
const router = express.Router();

// Get all budgets with spending
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period = 'monthly' } = req.query;
    const pool = req.app.get('dbPool');
    
    const [budgets] = await pool.execute(`
      SELECT 
        b.*,
        c.name as categoryName,
        c.color as categoryColor,
        c.icon as categoryIcon,
        COALESCE(SUM(t.amount), 0) as spent
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      LEFT JOIN transactions t ON t.categoryId = b.categoryId 
        AND t.userId = b.userId 
        AND t.type = 'expense'
        AND t.transactionDate >= b.startDate
        AND (b.endDate IS NULL OR t.transactionDate <= b.endDate)
      WHERE b.userId = ? AND b.period = ?
      GROUP BY b.id
      ORDER BY b.createdAt DESC
    `, [userId, period]);
    
    // Calculate percentage and status for each budget
    const budgetsWithStatus = budgets.map(budget => ({
      ...budget,
      spent: parseFloat(budget.spent),
      amount: parseFloat(budget.amount),
      percentage: (parseFloat(budget.spent) / parseFloat(budget.amount)) * 100,
      remaining: parseFloat(budget.amount) - parseFloat(budget.spent),
      status: parseFloat(budget.spent) >= parseFloat(budget.amount) 
        ? 'exceeded' 
        : parseFloat(budget.spent) >= (parseFloat(budget.amount) * budget.alertThreshold / 100)
          ? 'warning'
          : 'good'
    }));
    
    res.json({
      success: true,
      data: budgetsWithStatus
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch budgets'
    });
  }
});

// Create budget
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { categoryId, amount, period, startDate, endDate, alertThreshold } = req.body;
    const pool = req.app.get('dbPool');
    
    if (!categoryId || !amount || !period || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'CategoryId, amount, period, and startDate are required'
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
        error: 'Category not found or access denied'
      });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO budgets 
      (userId, categoryId, amount, period, startDate, endDate, alertThreshold)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, categoryId, amount, period, startDate, endDate || null, alertThreshold || 80]);
    
    const [newBudget] = await pool.execute(`
      SELECT 
        b.*,
        c.name as categoryName,
        c.color as categoryColor
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.id = ?
    `, [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: newBudget[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: 'Budget already exists for this category and period'
      });
    }
    console.error('Create budget error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create budget'
    });
  }
});

// Update budget
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { amount, endDate, alertThreshold } = req.body;
    const pool = req.app.get('dbPool');
    
    const [result] = await pool.execute(`
      UPDATE budgets 
      SET amount = ?, endDate = ?, alertThreshold = ?
      WHERE id = ? AND userId = ?
    `, [amount, endDate, alertThreshold, id, userId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found'
      });
    }
    
    const [updated] = await pool.execute(`
      SELECT 
        b.*,
        c.name as categoryName,
        c.color as categoryColor
      FROM budgets b
      JOIN categories c ON b.categoryId = c.id
      WHERE b.id = ?
    `, [id]);
    
    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: updated[0]
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update budget'
    });
  }
});

// Delete budget
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = req.app.get('dbPool');
    
    const [result] = await pool.execute(
      'DELETE FROM budgets WHERE id = ? AND userId = ?',
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Budget not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete budget'
    });
  }
});

module.exports = router;
```

---

## Frontend Integration

### 9. React Frontend Example

#### Install Dependencies
```bash
npx create-react-app expense-tracker-client
cd expense-tracker-client
npm install axios react-router-dom date-fns recharts
```

#### API Service (src/services/api.js)

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If token expired, try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user, tokens } = response.data.data;
    
    // Store tokens
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },
  
  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    await api.post('/auth/logout', { refreshToken });
    
    // Clear storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  
  completeSetup: async () => {
    const response = await api.post('/auth/register-complete');
    return response.data;
  }
};

// Transaction API
export const transactionAPI = {
  getAll: async (params = {}) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },
  
  create: async (transactionData) => {
    const response = await api.post('/transactions', transactionData);
    return response.data;
  },
  
  update: async (id, transactionData) => {
    const response = await api.put(`/transactions/${id}`, transactionData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },
  
  getSummary: async (params = {}) => {
    const response = await api.get('/transactions/summary/stats', { params });
    return response.data;
  }
};

// Category API
export const categoryAPI = {
  getAll: async (type) => {
    const response = await api.get('/categories', { params: { type } });
    return response.data;
  },
  
  create: async (categoryData) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },
  
  update: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};

// Account API
export const accountAPI = {
  getAll: async () => {
    const response = await api.get('/accounts');
    return response.data;
  },
  
  create: async (accountData) => {
    const response = await api.post('/accounts', accountData);
    return response.data;
  },
  
  update: async (id, accountData) => {
    const response = await api.put(`/accounts/${id}`, accountData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/accounts/${id}`);
    return response.data;
  }
};

// Budget API
export const budgetAPI = {
  getAll: async (period) => {
    const response = await api.get('/budgets', { params: { period } });
    return response.data;
  },
  
  create: async (budgetData) => {
    const response = await api.post('/budgets', budgetData);
    return response.data;
  },
  
  update: async (id, budgetData) => {
    const response = await api.put(`/budgets/${id}`, budgetData);
    return response.data;
  },
  
  delete: async (id) => {
    const response = await api.delete(`/budgets/${id}`);
    return response.data;
  }
};

export default api;
```

#### Auth Context (src/context/AuthContext.js)

```javascript
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    const accessToken = localStorage.getItem('accessToken');

    if (storedUser && accessToken) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      setUser(response.data.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      setUser(response.data.user);
      setIsAuthenticated(true);
      
      // Complete setup
      await authAPI.completeSetup();
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

#### Protected Route Component (src/components/ProtectedRoute.js)

```javascript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
```

#### Dashboard Component (src/pages/Dashboard.js)

```javascript
import React, { useState, useEffect } from 'react';
import { transactionAPI, accountAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch summary statistics
      const summaryResponse = await transactionAPI.getSummary({ period: 'month' });
      setSummary(summaryResponse.data);
      
      // Fetch accounts
      const accountsResponse = await accountAPI.getAll();
      setAccounts(accountsResponse.data);
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Welcome back, {user.firstName}!</h1>
      
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="card income">
          <h3>Total Income</h3>
          <p className="amount">${summary?.totals.income.toFixed(2)}</p>
        </div>
        
        <div className="card expense">
          <h3>Total Expenses</h3>
          <p className="amount">${summary?.totals.expenses.toFixed(2)}</p>
        </div>
        
        <div className="card balance">
          <h3>Balance</h3>
          <p className="amount">${summary?.totals.balance.toFixed(2)}</p>
        </div>
      </div>
      
      {/* Accounts */}
      <div className="accounts-section">
        <h2>Accounts</h2>
        <div className="accounts-grid">
          {accounts.map(account => (
            <div key={account.id} className="account-card">
              <h3>{account.name}</h3>
              <p className="account-type">{account.type}</p>
              <p className="balance">${account.balance.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Category Breakdown */}
      <div className="category-breakdown">
        <h2>Spending by Category</h2>
        <div className="category-list">
          {summary?.byCategory.filter(cat => cat.type === 'expense').map(category => (
            <div key={category.name} className="category-item">
              <div className="category-info">
                <span 
                  className="category-color" 
                  style={{ backgroundColor: category.color }}
                />
                <span className="category-name">{category.name}</span>
              </div>
              <span className="category-amount">${category.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```

Continue in Part 3...
