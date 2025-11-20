require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('../src/index');

const app = express();
app.use(express.json());

// Initialize SecureNodeAuth
const auth = new SecureNodeAuth({
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'secure_node_auth_example',
    port: process.env.DB_PORT || 3306
  }
});

// Initialize auth system
auth.init()
  .then(async () => {
    console.log('🔐 Auth system initialized successfully');
    
    // Mount auth routes
    app.use('/auth', auth.router());
    
    // ==========================================
    // EXAMPLE 1: Get current user's posts
    // ==========================================
    app.get('/api/posts/my-posts', auth.middleware(), async (req, res) => {
      try {
        // req.user contains: { userId, email, iat, exp }
        const userId = req.user.userId;

        // Get posts from database (example query)
        const pool = auth.getPool();
        const [posts] = await pool.execute(
          'SELECT * FROM posts WHERE userId = ? ORDER BY createdAt DESC',
          [userId]
        );

        res.json({
          success: true,
          user: {
            id: userId,
            email: req.user.email,
          },
          posts: posts,
          totalPosts: posts.length,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 2: Create a new post for current user
    // ==========================================
    app.post('/api/posts', auth.middleware(), async (req, res) => {
      try {
        const userId = req.user.userId;
        const { title, content } = req.body;

        if (!title || !content) {
          return res.status(400).json({ error: 'Title and content required' });
        }

        // Insert post
        const pool = auth.getPool();
        const [result] = await pool.execute(
          'INSERT INTO posts (userId, title, content, createdAt) VALUES (?, ?, ?, NOW())',
          [userId, title, content]
        );

        res.status(201).json({
          success: true,
          message: 'Post created successfully',
          post: {
            id: result.insertId,
            userId,
            title,
            content,
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 3: Update user's own post
    // ==========================================
    app.patch('/api/posts/:postId', auth.middleware(), async (req, res) => {
      try {
        const userId = req.user.userId;
        const postId = req.params.postId;
        const { title, content } = req.body;

        const pool = auth.getPool();

        // Check if post belongs to user
        const [posts] = await pool.execute('SELECT * FROM posts WHERE id = ? AND userId = ?', [
          postId,
          userId,
        ]);

        if (posts.length === 0) {
          return res.status(404).json({
            error: 'Post not found or you do not have permission to edit it',
          });
        }

        // Update post
        await pool.execute(
          'UPDATE posts SET title = ?, content = ?, updatedAt = NOW() WHERE id = ? AND userId = ?',
          [title || posts[0].title, content || posts[0].content, postId, userId]
        );

        res.json({
          success: true,
          message: 'Post updated successfully',
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 4: Delete user's own post
    // ==========================================
    app.delete('/api/posts/:postId', auth.middleware(), async (req, res) => {
      try {
        const userId = req.user.userId;
        const postId = req.params.postId;

        const pool = auth.getPool();

        // Delete only if post belongs to user
        const [result] = await pool.execute('DELETE FROM posts WHERE id = ? AND userId = ?', [
          postId,
          userId,
        ]);

        if (result.affectedRows === 0) {
          return res.status(404).json({
            error: 'Post not found or you do not have permission to delete it',
          });
        }

        res.json({
          success: true,
          message: 'Post deleted successfully',
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 5: Get user profile with post count
    // ==========================================
    app.get('/api/profile/stats', auth.middleware(), async (req, res) => {
      try {
        const userId = req.user.userId;

        // Get user details
        const user = await auth.getUserById(userId);

        // Get post count
        const pool = auth.getPool();
        const [result] = await pool.execute(
          'SELECT COUNT(*) as postCount FROM posts WHERE userId = ?',
          [userId]
        );

        res.json({
          success: true,
          profile: {
            ...user,
            stats: {
              totalPosts: result[0].postCount,
            },
          },
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 6: Get public posts (no auth required)
    // ==========================================
    app.get('/api/posts/public', async (req, res) => {
      try {
        const pool = auth.getPool();

        // Get all posts with user information (JOIN)
        const [posts] = await pool.execute(`
          SELECT 
            p.id, 
            p.title, 
            p.content, 
            p.createdAt,
            u.firstName,
            u.lastName,
            u.email
          FROM posts p
          INNER JOIN ${auth.options.tables.users} u ON p.userId = u.id
          ORDER BY p.createdAt DESC
          LIMIT 50
        `);

        res.json({
          success: true,
          posts,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 7: Get specific user's posts by userId
    // ==========================================
    app.get('/api/users/:userId/posts', async (req, res) => {
      try {
        const userId = req.params.userId;

        const pool = auth.getPool();
        const [posts] = await pool.execute(
          'SELECT id, title, content, createdAt FROM posts WHERE userId = ? ORDER BY createdAt DESC',
          [userId]
        );

        // Get user info (without password)
        const user = await auth.getUserById(userId);

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          posts,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // EXAMPLE 8: Search posts (with optional auth)
    // ==========================================
    app.get('/api/posts/search', async (req, res) => {
      try {
        const searchQuery = req.query.q;

        if (!searchQuery) {
          return res.status(400).json({ error: 'Search query required' });
        }

        const pool = auth.getPool();
        const [posts] = await pool.execute(
          `SELECT p.*, u.firstName, u.lastName 
           FROM posts p
           INNER JOIN ${auth.options.tables.users} u ON p.userId = u.id
           WHERE p.title LIKE ? OR p.content LIKE ?
           ORDER BY p.createdAt DESC`,
          [`%${searchQuery}%`, `%${searchQuery}%`]
        );

        res.json({
          success: true,
          query: searchQuery,
          results: posts,
          count: posts.length,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==========================================
    // Helper: Create posts table if needed
    // ==========================================
    async function createPostsTable() {
      try {
        const pool = auth.getPool();
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS posts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NULL,
            FOREIGN KEY (userId) REFERENCES ${auth.options.tables.users}(id) ON DELETE CASCADE,
            INDEX idx_user_posts (userId, createdAt)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Posts table created/verified');
      } catch (error) {
        console.error('Error creating posts table:', error.message);
      }
    }
    
    await createPostsTable();

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`\n📚 Available Endpoints:`);
      console.log(`\n🔓 Public (No Auth):`);
      console.log(`   GET    /api/posts/public`);
      console.log(`   GET    /api/posts/search?q=keyword`);
      console.log(`   GET    /api/users/:userId/posts`);
      console.log(`\n🔐 Protected (Auth Required):`);
      console.log(`   GET    /api/posts/my-posts - Get current user's posts`);
      console.log(`   POST   /api/posts - Create new post`);
      console.log(`   PATCH  /api/posts/:postId - Update own post`);
      console.log(`   DELETE /api/posts/:postId - Delete own post`);
      console.log(`   GET    /api/profile/stats - Get profile with stats`);
      console.log(`\n🔑 Authentication:`);
      console.log(`   POST   /auth/register`);
      console.log(`   POST   /auth/login`);
      console.log(`   GET    /auth/me`);
      console.log(`\n💡 Usage:`);
      console.log(`   1. Register/Login to get access token`);
      console.log(`   2. Use token in header: Authorization: Bearer <token>`);
      console.log(`   3. Access your posts at /api/posts/my-posts`);
    });
  })
  .catch(error => {
    console.error('❌ Failed to initialize auth system:', error.message);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await auth.close();
  process.exit(0);
});
