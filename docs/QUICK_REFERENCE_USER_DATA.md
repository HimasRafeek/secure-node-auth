# 🎯 Quick Reference: User Data Access

## The Essential Pattern

```javascript
app.get('/api/my-data', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;  // 👈 Get authenticated user's ID
  
  // Use userId to fetch only this user's data
  const [data] = await pool.execute(
    'SELECT * FROM table WHERE userId = ?',
    [userId]
  );
  
  res.json({ data });
});
```

---

## Common Patterns Cheat Sheet

### 📖 Read (GET)
```javascript
// Get my posts
app.get('/api/posts/mine', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;
  const [posts] = await pool.execute(
    'SELECT * FROM posts WHERE userId = ?', [userId]
  );
  res.json({ posts });
});
```

### ✏️ Create (POST)
```javascript
// Create post
app.post('/api/posts', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;
  const { title, content } = req.body;
  
  await pool.execute(
    'INSERT INTO posts (userId, title, content) VALUES (?, ?, ?)',
    [userId, title, content]
  );
  
  res.json({ success: true });
});
```

### 🔄 Update (PATCH)
```javascript
// Update my post
app.patch('/api/posts/:id', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;
  const postId = req.params.id;
  
  // ⚠️ Important: Check ownership!
  const [result] = await pool.execute(
    'UPDATE posts SET title = ? WHERE id = ? AND userId = ?',
    [req.body.title, postId, userId]
  );
  
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Not found or unauthorized' });
  }
  
  res.json({ success: true });
});
```

### 🗑️ Delete (DELETE)
```javascript
// Delete my post
app.delete('/api/posts/:id', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;
  const postId = req.params.id;
  
  // ⚠️ Important: Check ownership!
  const [result] = await pool.execute(
    'DELETE FROM posts WHERE id = ? AND userId = ?',
    [postId, userId]
  );
  
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Not found or unauthorized' });
  }
  
  res.json({ success: true });
});
```

---

## What's in `req.user`?

```javascript
req.user = {
  userId: 123,              // Database user ID
  email: "user@example.com", // User email
  iat: 1699268400,          // Issued at (timestamp)
  exp: 1699269300           // Expires at (timestamp)
}
```

---

## Security Checklist ✅

```javascript
// ✅ DO: Get user ID from token
const userId = req.user.userId;

// ❌ DON'T: Get user ID from request body
const userId = req.body.userId; // Client can fake this!

// ✅ DO: Always verify ownership
WHERE id = ? AND userId = ?

// ❌ DON'T: Trust client without checking
WHERE id = ?  // Anyone can access any post!

// ✅ DO: Use parameterized queries
await pool.execute('SELECT * FROM posts WHERE userId = ?', [userId]);

// ❌ DON'T: Concatenate strings
await pool.execute(`SELECT * FROM posts WHERE userId = ${userId}`);
```

---

## Testing Flow

```bash
# 1. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123!"}'

# Response includes: "accessToken": "eyJhbG..."

# 2. Use token in subsequent requests
TOKEN="eyJhbG..."

curl http://localhost:3000/api/posts/mine \
  -H "Authorization: Bearer $TOKEN"
```

---

## Database Setup

```sql
-- Link data to users with foreign key
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  title VARCHAR(255),
  content TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Link to users table
  FOREIGN KEY (userId) 
    REFERENCES secure_auth_users(id) 
    ON DELETE CASCADE,
    
  -- Speed up queries
  INDEX idx_user_posts (userId, createdAt)
);
```

---

## Common Mistakes ❌

### Mistake 1: Not checking ownership
```javascript
// ❌ BAD
app.delete('/api/posts/:id', auth.middleware(), async (req, res) => {
  await pool.execute('DELETE FROM posts WHERE id = ?', [req.params.id]);
  // User can delete ANYONE's post!
});

// ✅ GOOD
app.delete('/api/posts/:id', auth.middleware(), async (req, res) => {
  await pool.execute(
    'DELETE FROM posts WHERE id = ? AND userId = ?',
    [req.params.id, req.user.userId]
  );
});
```

### Mistake 2: Trusting client-provided IDs
```javascript
// ❌ BAD
app.post('/api/posts', auth.middleware(), async (req, res) => {
  const { userId, title } = req.body;
  // Client can fake userId!
  await pool.execute('INSERT INTO posts (userId, title) VALUES (?, ?)', 
    [userId, title]);
});

// ✅ GOOD
app.post('/api/posts', auth.middleware(), async (req, res) => {
  const userId = req.user.userId;  // From authenticated token
  const { title } = req.body;
  await pool.execute('INSERT INTO posts (userId, title) VALUES (?, ?)', 
    [userId, title]);
});
```

### Mistake 3: SQL injection
```javascript
// ❌ BAD
const userId = req.user.userId;
const [posts] = await pool.execute(
  `SELECT * FROM posts WHERE userId = ${userId}`
);

// ✅ GOOD
const userId = req.user.userId;
const [posts] = await pool.execute(
  'SELECT * FROM posts WHERE userId = ?',
  [userId]
);
```

---

## Frontend Integration

```javascript
// Save token after login
localStorage.setItem('accessToken', token);

// Use token in requests
const response = await fetch('/api/posts/mine', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```

---

## Quick Troubleshooting

| Error | Solution |
|-------|----------|
| "No token provided" | Add `Authorization: Bearer TOKEN` header |
| "Invalid token" | Token expired or invalid, login again |
| "Not found or unauthorized" | User doesn't own the resource |
| SQL error | Check database exists and table created |

---

## 🎓 Remember

1. **Always** use `req.user.userId` (from token)
2. **Never** trust `req.body.userId` (from client)
3. **Always** check ownership (WHERE ... AND userId = ?)
4. **Always** use parameterized queries (?)
5. **Always** validate inputs

---

## Need More Help?

- Full guide: [USER_DATA_ACCESS.md](USER_DATA_ACCESS.md)
- Working example: [examples/user-posts-example.js](../examples/user-posts-example.js)
- Flow diagram: [FLOW_DIAGRAM.md](FLOW_DIAGRAM.md)

---

**That's it! You now know how to securely access user-specific data! 🎉**
