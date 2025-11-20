# 🔄 Authentication Flow Diagram

> **v1.4.3+**: All flows work identically with MySQL and PostgreSQL.

## How User Data Access Works

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER AUTHENTICATION FLOW                       │
└──────────────────────────────────────────────────────────────────┘

Step 1: USER REGISTERS/LOGINS
┌─────────────┐
│   Client    │──────┐
│  (Browser)  │      │ POST /auth/register
└─────────────┘      │ { email, password }
                     ▼
              ┌──────────────┐
              │    Server    │
              │ (Auth System)│
              └──────────────┘
                     │
                     │ Creates user record
                     ▼
              ┌──────────────┐
              │   Database   │
              │ secure_auth_ │──── Stores: id=123, email, password_hash
              │    users     │
              └──────────────┘
                     │
                     │ Returns JWT tokens
                     ▼
┌─────────────┐      │
│   Client    │◄─────┘
│  Receives:  │
│  accessToken: "eyJhbG..."
│  refreshToken: "eyJhbG..."
└─────────────┘


Step 2: CLIENT MAKES AUTHENTICATED REQUEST
┌─────────────┐
│   Client    │──────┐
│             │      │ GET /api/posts/my-posts
│ Sends:      │      │ Authorization: Bearer eyJhbG...
│ accessToken │      │
└─────────────┘      ▼
              ┌──────────────────────┐
              │ auth.middleware()     │
              │                       │
              │ 1. Extract token      │
              │ 2. Verify signature   │
              │ 3. Check expiration   │
              │ 4. Decode payload     │
              └──────────────────────┘
                     │
                     │ Token is valid!
                     ▼
              ┌──────────────────────┐
              │  Route Handler        │
              │                       │
              │  req.user = {         │
              │    userId: 123,       │──── 👈 This is the key!
              │    email: "user@..."  │
              │  }                    │
              └──────────────────────┘
                     │
                     │ Query with userId
                     ▼
              ┌──────────────────────┐
              │   Database Query      │
              │                       │
              │ SELECT * FROM posts   │
              │ WHERE userId = 123    │──── Only user's data!
              └──────────────────────┘
                     │
                     │ Returns user's posts
                     ▼
┌─────────────┐      │
│   Client    │◄─────┘
│  Receives:  │
│  { posts: [...] }
└─────────────┘


Step 3: CLIENT CREATES NEW POST
┌─────────────┐
│   Client    │──────┐
│             │      │ POST /api/posts
│ Sends:      │      │ Authorization: Bearer eyJhbG...
│ {title,     │      │ { title: "My Post", content: "..." }
│  content}   │      │
└─────────────┘      ▼
              ┌──────────────────────┐
              │ auth.middleware()     │
              │ Decodes to:           │
              │ req.user.userId = 123 │
              └──────────────────────┘
                     │
                     ▼
              ┌──────────────────────┐
              │  Route Handler        │
              │                       │
              │ const userId =        │
              │   req.user.userId;    │──── Gets authenticated user's ID
              │                       │
              │ INSERT INTO posts     │
              │ (userId, title, ...)  │
              │ VALUES (123, ...)     │──── Automatically ties to user!
              └──────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │   Database   │
              │    posts     │──── Stores: id=1, userId=123, title, content
              └──────────────┘
                     │
                     ▼
┌─────────────┐      │
│   Client    │◄─────┘
│  Success!   │
└─────────────┘


Step 4: USER UPDATES THEIR POST
┌─────────────┐
│   Client    │──────┐
│             │      │ PATCH /api/posts/5
│ Sends:      │      │ Authorization: Bearer eyJhbG...
│ {title:     │      │ { title: "Updated" }
│  "Updated"} │      │
└─────────────┘      ▼
              ┌──────────────────────┐
              │ auth.middleware()     │
              │ req.user.userId = 123 │
              └──────────────────────┘
                     │
                     ▼
              ┌──────────────────────────────┐
              │  Route Handler                │
              │                               │
              │  // SECURITY CHECK!           │
              │  SELECT * FROM posts          │
              │  WHERE id = 5                 │──── Verify ownership
              │  AND userId = 123             │
              │                               │
              │  if (found) {                 │
              │    UPDATE posts               │
              │    WHERE id = 5               │
              │    AND userId = 123           │
              │  } else {                     │
              │    return 403 Forbidden       │──── Can't edit others' posts!
              │  }                            │
              └──────────────────────────────┘
```

---

## 🔑 The Magic: `req.user.userId`

Every authenticated request automatically has access to:

```javascript
req.user = {
  userId: 123,              // ← Use this to filter user's data
  email: "user@example.com",
  iat: 1699268400,          // Token issued at
  exp: 1699269300           // Token expires at
}
```

---

## 📊 Database Relationships

```
┌─────────────────────────────┐
│   secure_auth_users          │
├─────────────────────────────┤
│ id (PK)        │ 123        │ ←────┐
│ email          │ user@...   │      │
│ password       │ $2b$10...  │      │
│ firstName      │ John       │      │
│ createdAt      │ 2025-11-06 │      │
└─────────────────────────────┘      │
                                     │
                                     │ FOREIGN KEY
                                     │ (userId)
                                     │
┌─────────────────────────────┐      │
│   posts                      │      │
├─────────────────────────────┤      │
│ id (PK)        │ 1          │      │
│ userId (FK)    │ 123        │ ─────┘
│ title          │ My Post    │
│ content        │ Hello!     │
│ createdAt      │ 2025-11-06 │
└─────────────────────────────┘

    ↑
    │ SELECT * FROM posts WHERE userId = 123
    │
    This query ONLY returns posts
    belonging to user with id=123
```

---

## 🎯 Key Security Principles

```javascript
// ✅ ALWAYS filter by authenticated user
const userId = req.user.userId;  // From JWT token
const [posts] = await pool.execute(
  'SELECT * FROM posts WHERE userId = ?',
  [userId]  // Only returns THIS user's posts
);

// ✅ ALWAYS verify ownership before update/delete
const [result] = await pool.execute(
  'DELETE FROM posts WHERE id = ? AND userId = ?',
  [postId, userId]  // AND ensures user owns the post
);

// ❌ NEVER trust client-provided user IDs
// Bad: const userId = req.body.userId; 
// Good: const userId = req.user.userId;
```

---

## 🔄 Complete Flow Summary

```
1. User logs in
   ↓
2. Server creates JWT with userId
   ↓
3. Client stores token
   ↓
4. Client sends token with every request
   ↓
5. Middleware extracts userId from token
   ↓
6. Route handler uses userId to query database
   ↓
7. Database returns only that user's data
```

---

## 💡 Simple Example

```javascript
// User A (userId: 123) logs in
// Gets token: eyJhbG...userId:123...

// User A requests their posts:
app.get('/api/posts/my-posts', auth.middleware(), async (req, res) => {
  // req.user.userId = 123 (from token)
  
  const [posts] = await pool.execute(
    'SELECT * FROM posts WHERE userId = ?',
    [req.user.userId]  // = 123
  );
  
  // Returns only posts where userId = 123
  res.json({ posts });
});

// User A CANNOT see User B's posts because:
// - Token contains userId = 123
// - Query filters by userId = 123
// - User B's posts have userId = 456
// - 123 ≠ 456, so User B's posts are excluded
```

This is how secure-node-auth protects user data! 🔒
