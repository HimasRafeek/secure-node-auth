# 🔐 Accessing User-Specific Data with Authentication

## Overview

This guide shows you how to use **secure-node-auth** to protect routes and access data belonging to the authenticated user (like posts, comments, orders, etc.).

## 🎯 Key Concept: `req.user`

When a user is authenticated, the `auth.middleware()` adds the user's information to `req.user`:

```javascript
req.user = {
  userId: 123,        // User's ID from database
  email: "user@example.com",
  iat: 1699268400,    // Token issued at
  exp: 1699269300     // Token expires at
}
```

## 📋 Complete Examples

### 1. Get Current User's Posts

```javascript
app.get('/api/posts/my-posts', auth.middleware(), async (req, res) => {
  try {
    const userId = req.user.userId;  // 👈 Get authenticated user's ID
    
    // Query posts for this user
    const pool = auth.getPool();
    const [posts] = await pool.execute(
      'SELECT * FROM posts WHERE userId = ? ORDER BY createdAt DESC',
      [userId]
    );
    
    res.json({
      user: req.user,
      posts: posts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Usage:**
```bash
curl -X GET http://localhost:3000/api/posts/my-posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

### 2. Create Post for Current User

```javascript
app.post('/api/posts', auth.middleware(), async (req, res) => {
  try {
    const userId = req.user.userId;  // 👈 Automatically get user ID
    const { title, content } = req.body;
    
    const pool = auth.getPool();
    const [result] = await pool.execute(
      'INSERT INTO posts (userId, title, content) VALUES (?, ?, ?)',
      [userId, title, content]
    );
    
    res.json({
      success: true,
      post: {
        id: result.insertId,
        userId,
        title,
        content
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Usage:**
```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My First Post","content":"Hello world!"}'
```

---

### 3. Update Only User's Own Post

```javascript
app.patch('/api/posts/:postId', auth.middleware(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = req.params.postId;
    const { title, content } = req.body;
    
    const pool = auth.getPool();
    
    // 🔒 Security: Check if post belongs to user
    const [posts] = await pool.execute(
      'SELECT * FROM posts WHERE id = ? AND userId = ?',
      [postId, userId]
    );
    
    if (posts.length === 0) {
      return res.status(404).json({ 
        error: 'Post not found or unauthorized' 
      });
    }
    
    // Update the post
    await pool.execute(
      'UPDATE posts SET title = ?, content = ? WHERE id = ? AND userId = ?',
      [title, content, postId, userId]
    );
    
    res.json({ success: true, message: 'Post updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Key Point:** Always verify the data belongs to the authenticated user!

---

### 4. Delete Only User's Own Post

```javascript
app.delete('/api/posts/:postId', auth.middleware(), async (req, res) => {
  try {
    const userId = req.user.userId;
    const postId = req.params.postId;
    
    const pool = auth.getPool();
    
    // 🔒 Delete only if userId matches
    const [result] = await pool.execute(
      'DELETE FROM posts WHERE id = ? AND userId = ?',
      [postId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }
    
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### 5. Get User Profile with Custom Data

```javascript
app.get('/api/profile/dashboard', auth.middleware(), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user details
    const user = await auth.getUserById(userId);
    
    // Get user's statistics
    const pool = auth.getPool();
    
    const [postStats] = await pool.execute(
      'SELECT COUNT(*) as total FROM posts WHERE userId = ?',
      [userId]
    );
    
    const [recentPosts] = await pool.execute(
      'SELECT * FROM posts WHERE userId = ? ORDER BY createdAt DESC LIMIT 5',
      [userId]
    );
    
    res.json({
      user: user,
      stats: {
        totalPosts: postStats[0].total
      },
      recentPosts: recentPosts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🔄 Complete Workflow Example

### Step 1: Register User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "firstName": "John"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "john@example.com" },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### Step 2: Create Post (Using Access Token)

```bash
# Save the access token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "content": "This is my first blog post!"
  }'
```

### Step 3: Get Your Posts

```bash
curl -X GET http://localhost:3000/api/posts/my-posts \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "success": true,
  "user": { "userId": 1, "email": "john@example.com" },
  "posts": [
    {
      "id": 1,
      "userId": 1,
      "title": "My First Post",
      "content": "This is my first blog post!",
      "createdAt": "2025-11-06T10:30:00.000Z"
    }
  ],
  "totalPosts": 1
}
```

---

## 🏗️ Database Schema Setup

Create a posts table linked to users:

```sql
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NULL,
  FOREIGN KEY (userId) REFERENCES secure_auth_users(id) ON DELETE CASCADE,
  INDEX idx_user_posts (userId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Key points:**
- `userId` links to the authenticated user
- `FOREIGN KEY` ensures data integrity
- `ON DELETE CASCADE` removes posts when user is deleted
- `INDEX` on `userId` for fast queries

---

## 🔒 Security Best Practices

### ✅ Always Verify Ownership

```javascript
// ❌ BAD - Anyone can delete any post
app.delete('/api/posts/:postId', auth.middleware(), async (req, res) => {
  await pool.execute('DELETE FROM posts WHERE id = ?', [req.params.postId]);
});

// ✅ GOOD - Only owner can delete
app.delete('/api/posts/:postId', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.execute(
    'DELETE FROM posts WHERE id = ? AND userId = ?',
    [req.params.postId, userId]
  );
  
  if (result.affectedRows === 0) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
});
```

### ✅ Use Parameterized Queries

```javascript
// ❌ BAD - SQL Injection vulnerability
const [posts] = await pool.execute(
  `SELECT * FROM posts WHERE userId = ${userId}`
);

// ✅ GOOD - Safe from SQL injection
const [posts] = await pool.execute(
  'SELECT * FROM posts WHERE userId = ?',
  [userId]
);
```

### ✅ Return Only Necessary Data

```javascript
// ❌ BAD - Exposing sensitive data
const user = await auth.getUserById(userId);
res.json({ user }); // Includes password hash!

// ✅ GOOD - Select only public fields
const { password, ...safeUser } = await auth.getUserById(userId);
res.json({ user: safeUser });
```

---

## 🎨 Advanced Patterns

### Pattern 1: Middleware to Load User Data

```javascript
// Middleware to automatically load user
const loadUserData = async (req, res, next) => {
  try {
    req.currentUser = await auth.getUserById(req.user.userId);
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to load user' });
  }
};

// Use it
app.get('/api/dashboard', 
  auth.middleware(), 
  loadUserData, 
  async (req, res) => {
    // req.currentUser has full user object
    res.json({ user: req.currentUser });
  }
);
```

### Pattern 2: Optional Authentication

```javascript
// Middleware for optional auth
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = await auth.verifyAccessToken(token);
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }
  next();
};

// Use it
app.get('/api/posts', optionalAuth, async (req, res) => {
  const pool = auth.getPool();
  
  if (req.user) {
    // Show user's posts + public posts
    const [posts] = await pool.execute(
      'SELECT * FROM posts WHERE userId = ? OR isPublic = 1',
      [req.user.userId]
    );
  } else {
    // Show only public posts
    const [posts] = await pool.execute(
      'SELECT * FROM posts WHERE isPublic = 1'
    );
  }
  
  res.json({ posts });
});
```

### Pattern 3: Role-Based Access

```javascript
// Add role to user schema
auth.addField({ 
  name: 'role', 
  type: "ENUM('user', 'admin', 'moderator')",
  defaultValue: 'user'
});

// Role checker middleware
const requireRole = (role) => {
  return async (req, res, next) => {
    const user = await auth.getUserById(req.user.userId);
    
    if (user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Admin-only route
app.get('/api/admin/all-posts', 
  auth.middleware(), 
  requireRole('admin'),
  async (req, res) => {
    const pool = auth.getPool();
    const [posts] = await pool.execute('SELECT * FROM posts');
    res.json({ posts });
  }
);
```

---

## 🧪 Testing with curl

### Complete Test Flow

```bash
# 1. Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Save the access token from response
TOKEN="your_access_token_here"

# 2. Create post
curl -X POST http://localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Post","content":"Hello!"}'

# 3. Get your posts
curl -X GET http://localhost:3000/api/posts/my-posts \
  -H "Authorization: Bearer $TOKEN"

# 4. Update post (replace :postId with actual ID)
curl -X PATCH http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title"}'

# 5. Delete post
curl -X DELETE http://localhost:3000/api/posts/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📱 Frontend Integration

### JavaScript/Fetch Example

```javascript
// Store tokens after login
const login = async (email, password) => {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  // Save tokens
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
  
  return data;
};

// Get user's posts
const getMyPosts = async () => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3000/api/posts/my-posts', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};

// Create post
const createPost = async (title, content) => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3000/api/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, content })
  });
  
  return await response.json();
};
```

---

## 🎯 Summary

**Key Takeaways:**

1. ✅ Use `auth.middleware()` to protect routes
2. ✅ Access user ID via `req.user.userId`
3. ✅ Always verify ownership before modify/delete
4. ✅ Use parameterized queries for security
5. ✅ Link user data with foreign keys
6. ✅ Return only necessary data

**The authenticated user is available in `req.user` on all protected routes!**

---

## 🚀 Run the Example

```bash
# Run the complete example
node examples/user-posts-example.js

# Test it
curl http://localhost:3000/auth/register -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

Happy coding! 🎉
