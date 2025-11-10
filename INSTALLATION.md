# 🔥 Secure Node Auth - Installation & Testing Guide

## 🚀 Quick Start (Copy & Paste)

### Step 1: Install Package (when published)
```bash
npm install secure-node-auth express dotenv
```

### Step 2: Create Project Files

**1. Create `.env` file:**
```bash
cat > .env << 'EOF'
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=secure_node_auth_test
JWT_ACCESS_SECRET=your_super_secret_access_key_change_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_in_production
PORT=3000
EOF
```

**2. Create `server.js`:**
```bash
cat > server.js << 'EOF'
require('dotenv').config();
const express = require('express');
const SecureNodeAuth = require('secure-node-auth');

const app = express();
app.use(express.json());

const auth = new SecureNodeAuth();

auth.init().then(() => {
  console.log('✅ Auth initialized');
  
  app.use('/auth', auth.router());
  
  app.get('/api/protected', auth.middleware(), (req, res) => {
    res.json({ message: 'Protected route!', user: req.user });
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📝 Register: POST http://localhost:${PORT}/auth/register`);
    console.log(`🔐 Login: POST http://localhost:${PORT}/auth/login`);
  });
}).catch(console.error);
EOF
```

### Step 3: Create Database
```bash
mysql -u root -p << 'EOF'
CREATE DATABASE IF NOT EXISTS secure_node_auth_test 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
EOF
```

### Step 4: Run Server
```bash
node server.js
```

---

## 🧪 Testing Commands

### Test 1: Health Check
```bash
curl http://localhost:3000/auth/health
```

**Expected Output:**
```json
{
  "status": "ok",
  "service": "secure-node-auth",
  "timestamp": "2025-11-06T..."
}
```

---

### Test 2: Register User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Output:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "test@example.com",
      "firstName": "John",
      "lastName": "Doe",
      ...
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "15m"
    }
  }
}
```

**Save the tokens for next tests!**

---

### Test 3: Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

---

### Test 4: Get Profile (Protected)
```bash
# Replace YOUR_ACCESS_TOKEN with actual token from login/register
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Output:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    ...
  }
}
```

---

### Test 5: Update Profile
```bash
curl -X PATCH http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Johnny"
  }'
```

---

### Test 6: Refresh Token
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

---

### Test 7: Change Password
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "SecurePass123!",
    "newPassword": "NewSecurePass456!"
  }'
```

---

### Test 8: Logout
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

---

### Test 9: Protected Route
```bash
curl -X GET http://localhost:3000/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📋 Automated Test Script

Create `test.sh`:

```bash
#!/bin/bash

echo "🧪 Testing Secure Node Auth"
echo "============================="

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo -e "\n1️⃣ Health Check"
curl -s $BASE_URL/auth/health | jq '.'

# Test 2: Register
echo -e "\n2️⃣ Register User"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@example.com",
    "password": "SecurePass123!",
    "firstName": "Test"
  }')

echo $REGISTER_RESPONSE | jq '.'

# Extract tokens
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.accessToken')
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.refreshToken')

echo "Access Token: ${ACCESS_TOKEN:0:50}..."
echo "Refresh Token: ${REFRESH_TOKEN:0:50}..."

# Test 3: Get Profile
echo -e "\n3️⃣ Get Profile"
curl -s -X GET $BASE_URL/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# Test 4: Refresh Token
echo -e "\n4️⃣ Refresh Token"
curl -s -X POST $BASE_URL/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq '.'

# Test 5: Logout
echo -e "\n5️⃣ Logout"
curl -s -X POST $BASE_URL/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" | jq '.'

echo -e "\n✅ All tests completed!"
```

Run it:
```bash
chmod +x test.sh
./test.sh
```

---

## 🔍 Verify Database

```bash
mysql -u root -p -e "
USE secure_node_auth_test;
SHOW TABLES;
SELECT * FROM secure_auth_users;
SELECT * FROM secure_auth_refresh_tokens;
SELECT * FROM secure_auth_login_attempts;
"
```

**You should see:**
- ✅ 3 tables created automatically
- ✅ User data stored
- ✅ Tokens tracked
- ✅ Login attempts logged

---

## ✅ Success Checklist

After running tests, you should see:

- [ ] Server starts without errors
- [ ] Database tables created automatically
- [ ] User registration works
- [ ] Login returns tokens
- [ ] Protected routes require authentication
- [ ] Token refresh works
- [ ] Profile updates work
- [ ] Logout revokes tokens

---

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check MySQL is running
mysql.server start  # Mac
net start mysql     # Windows
sudo systemctl start mysql  # Linux

# Verify credentials
mysql -u root -p
```

### Port Already in Use
```bash
# Change port in .env
echo "PORT=3001" >> .env

# Or kill process on port 3000
# Mac/Linux
lsof -ti:3000 | xargs kill -9
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Performance Test

Test rate limiting:

```bash
# Send 15 requests rapidly (should block after 10)
for i in {1..15}; do
  echo "Request $i:"
  curl -s http://localhost:3000/auth/health
  echo ""
done
```

Expected: First 10 succeed, last 5 get rate limited.

---

## 🎉 Success!

If all tests pass, your authentication system is working perfectly!

**Next steps:**
1. Read full documentation in README.md
2. Check examples/ folder for more use cases
3. Customize for your needs
4. Deploy to production!

---

**Questions? Check docs/ folder for comprehensive guides!**
