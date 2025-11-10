# Building Headless Apps with SecureNodeAuth
## Complete Guide Index

This comprehensive guide shows you how to use SecureNodeAuth as the authentication foundation for complex headless applications like income/expense trackers, task managers, CRM systems, and more.

---

## 📚 Guide Structure

### [Part 1: Foundation](HEADLESS_APPS_GUIDE.md)
**Setup, Database Schema, Core Backend**

- ✅ Architecture Overview (Headless design pattern)
- ✅ Database Schema Design (Complex relationships with foreign keys)
- ✅ Backend Setup (Project structure, environment config)
- ✅ Main Server File (Express + SecureNodeAuth integration)
- ✅ Auth Routes (Registration with auto-setup)
- ✅ Transaction Routes (Full CRUD with filtering, pagination)

**What You'll Learn:**
- How to separate authentication from application data
- Designing complex database schemas with foreign keys
- Auto-creating application tables alongside auth tables
- Implementing filtered and paginated endpoints
- Using database transactions for data consistency

---

### [Part 2: Additional Features](HEADLESS_APPS_GUIDE_PART2.md)
**Categories, Accounts, Budgets, Frontend Integration**

- ✅ Category Routes (Income/Expense categories with soft delete)
- ✅ Account Routes (Bank accounts, wallets, balances)
- ✅ Budget Routes (Monthly spending limits with alerts)
- ✅ React Frontend (Complete web app with auth context)
- ✅ API Service Layer (Axios with token refresh interceptor)
- ✅ Protected Routes (Auth-guarded components)
- ✅ Dashboard Component (Real-time stats and summaries)

**What You'll Learn:**
- Implementing soft deletes (for records with dependencies)
- Aggregating data across multiple tables
- Building reusable API service layers
- Token refresh automation in frontend
- Context API for global auth state

---

### [Part 3: Advanced Features](HEADLESS_APPS_GUIDE_PART3.md)
**Complex Operations, Mobile, Production Best Practices**

- ✅ Database Transactions (Account transfers with rollback)
- ✅ Recurring Transactions (Cron jobs for automation)
- ✅ Budget Alerts (Real-time monitoring)
- ✅ React Native Integration (Mobile app setup)
- ✅ AsyncStorage (Mobile token management)
- ✅ Security Best Practices (HTTPS, rate limiting, validation)
- ✅ Error Handling (Centralized error middleware)
- ✅ Database Backups (Automated backup scripts)
- ✅ Performance Monitoring (Request timing, slow query detection)
- ✅ Production Deployment Checklist

**What You'll Learn:**
- Implementing ACID transactions for complex operations
- Building scheduled background jobs
- Mobile app authentication patterns
- Production-grade security measures
- Monitoring and maintaining production systems

---

## 🎯 Use Cases

This guide's patterns apply to many types of applications:

### Financial Apps
- ✅ Income/Expense Tracker (this guide's example)
- ✅ Budget Manager
- ✅ Investment Portfolio Tracker
- ✅ Invoice/Billing System

### Productivity Apps
- ✅ Task/Project Manager
- ✅ Time Tracker
- ✅ Note-Taking App
- ✅ CRM System

### Lifestyle Apps
- ✅ Fitness Tracker
- ✅ Meal Planner
- ✅ Habit Tracker
- ✅ Travel Planner

### Business Apps
- ✅ Inventory Management
- ✅ Order Management
- ✅ Customer Portal
- ✅ Employee Management

---

## 🏗️ Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  (React / React Native / Vue / Angular / Mobile App)        │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API (JSON)
                     │ JWT Bearer Tokens
┌────────────────────▼────────────────────────────────────────┐
│                      Node.js Backend                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          SecureNodeAuth (Auth Layer)                 │   │
│  │  - User Registration & Login                        │   │
│  │  - JWT Token Management                             │   │
│  │  - Password Security (Bcrypt)                       │   │
│  │  - Account Lockout                                  │   │
│  │  - Audit Logging                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Your Application Logic                      │   │
│  │  - Transactions                                     │   │
│  │  - Categories                                       │   │
│  │  - Accounts                                         │   │
│  │  - Budgets                                          │   │
│  │  - Reports                                          │   │
│  │  - Any Custom Features                             │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL Queries
┌────────────────────▼────────────────────────────────────────┐
│                      MySQL Database                          │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │  Auth Tables     │  │  Application Tables          │   │
│  │  (Auto-created)  │  │  (Your custom schema)        │   │
│  │                  │  │                              │   │
│  │  • users         │  │  • transactions              │   │
│  │  • refresh_tokens│  │  • categories                │   │
│  │  • login_attempts│  │  • accounts                  │   │
│  └──────────────────┘  │  • budgets                   │   │
│                        │  • recurring_transactions    │   │
│                        │  • user_preferences          │   │
│                        └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Separation of Concerns**: Auth (SecureNodeAuth) vs Application Logic
2. **Data Isolation**: Foreign keys ensure users only access their data
3. **Stateless Authentication**: JWT tokens enable horizontal scaling
4. **Defense in Depth**: Multiple security layers (auth + validation + SQL protection)

---

## 💡 Quick Start

### 1. Install Dependencies
```bash
npm install express dotenv cors mysql2 secure-node-auth
```

### 2. Setup Environment
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_app
JWT_ACCESS_SECRET=min-32-chars-random-string
JWT_REFRESH_SECRET=different-32-chars-random-string
```

### 3. Initialize SecureNodeAuth
```javascript
const SecureNodeAuth = require('secure-node-auth');

const auth = new SecureNodeAuth({
  db: {
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

await auth.init(); // Creates auth tables
```

### 4. Create Your Application Tables
```javascript
// Your custom schema
await pool.query(`
  CREATE TABLE IF NOT EXISTS your_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    /* your columns here */
    FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE
  )
`);
```

### 5. Protect Your Routes
```javascript
// Use SecureNodeAuth middleware
app.get('/api/data', auth.middleware(), async (req, res) => {
  const userId = req.user.userId; // Auto-populated from JWT
  
  // Fetch only user's data
  const [rows] = await pool.execute(
    'SELECT * FROM your_data WHERE userId = ?',
    [userId]
  );
  
  res.json({ data: rows });
});
```

---

## 🔑 Key Features Demonstrated

### Authentication & Security
- ✅ JWT-based authentication (access + refresh tokens)
- ✅ Bcrypt password hashing
- ✅ Account lockout after failed attempts
- ✅ Token refresh automation
- ✅ Audit logging for security events
- ✅ SQL injection protection
- ✅ Input validation and sanitization

### Database Design
- ✅ Foreign keys for data relationships
- ✅ Cascading deletes (when user deleted, their data is too)
- ✅ Soft deletes (mark inactive instead of delete)
- ✅ Indexes for query performance
- ✅ Transactions for data consistency
- ✅ JSON columns for flexible data (tags, preferences)

### API Design
- ✅ RESTful endpoints
- ✅ Pagination for large datasets
- ✅ Filtering and sorting
- ✅ Aggregated statistics
- ✅ Error handling with proper HTTP status codes
- ✅ Rate limiting
- ✅ CORS configuration

### Frontend Integration
- ✅ Token storage (localStorage for web, AsyncStorage for mobile)
- ✅ Automatic token refresh
- ✅ Protected routes
- ✅ Auth context for global state
- ✅ API service layer
- ✅ Error handling

---

## 📖 Code Examples

### Backend: Fetch User's Transactions
```javascript
router.get('/transactions', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;
  
  const [transactions] = await pool.execute(`
    SELECT t.*, c.name as category, a.name as account
    FROM transactions t
    JOIN categories c ON t.categoryId = c.id
    JOIN accounts a ON t.accountId = a.id
    WHERE t.userId = ?
    ORDER BY t.transactionDate DESC
    LIMIT 50
  `, [userId]);
  
  res.json({ success: true, data: transactions });
});
```

### Frontend: Call Protected API
```javascript
// React
import { transactionAPI } from './services/api';

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  
  useEffect(() => {
    async function fetchData() {
      const response = await transactionAPI.getAll();
      setTransactions(response.data);
    }
    fetchData();
  }, []);
  
  return (
    <div>
      {transactions.map(t => (
        <div key={t.id}>{t.description} - ${t.amount}</div>
      ))}
    </div>
  );
}
```

### Mobile: Login Flow
```javascript
// React Native
import { authAPI } from './services/api';

async function handleLogin(email, password) {
  try {
    const response = await authAPI.login(email, password);
    // Tokens automatically stored in AsyncStorage
    navigation.navigate('Dashboard');
  } catch (error) {
    Alert.alert('Error', error.message);
  }
}
```

---

## 🚀 Next Steps

1. **Read the Guides**: Start with Part 1, then move to Parts 2 & 3
2. **Clone the Example**: Use the code as a starting point
3. **Customize Schema**: Replace transactions/categories with your data model
4. **Add Features**: Build on top of the authentication foundation
5. **Deploy**: Follow the production checklist in Part 3

---

## 🛡️ Security Highlights

All examples follow security best practices:

- ✅ Environment variables for secrets
- ✅ Parameterized SQL queries (no SQL injection)
- ✅ JWT validation on all protected routes
- ✅ User data isolation via foreign keys
- ✅ Rate limiting on endpoints
- ✅ Input validation and sanitization
- ✅ HTTPS enforcement (production)
- ✅ Audit logging for security events
- ✅ Token hashing in database
- ✅ Email normalization

Reviewed by dual security experts with 50 years combined experience!

---

## 📞 Support & Resources

- **Main Documentation**: [README.md](../README.md)
- **Security Guide**: [SECURITY.md](../SECURITY.md)
- **Security Audit**: [EXPERT-PANEL-AUDIT.md](../EXPERT-PANEL-AUDIT.md)
- **User Data Access**: [USER_DATA_ACCESS.md](USER_DATA_ACCESS.md)

---

**Built with ❤️ to help developers build secure, scalable headless applications!**
