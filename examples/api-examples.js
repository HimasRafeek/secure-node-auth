/**
 * Example API requests using the auth system
 * You can use these with tools like curl, Postman, or Insomnia
 */

// ============================================
// 1. REGISTER NEW USER
// ============================================
/*
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "companyName": "Tech Corp"
}

Response:
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phoneNumber": "+1234567890",
      "companyName": "Tech Corp",
      "emailVerified": false,
      "isActive": true,
      "createdAt": "2025-11-06T10:30:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "15m"
    }
  }
}
*/

// ============================================
// 2. LOGIN
// ============================================
/*
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "...",
      "refreshToken": "...",
      "expiresIn": "15m"
    }
  }
}
*/

// ============================================
// 3. GET CURRENT USER (Protected Route)
// ============================================
/*
GET http://localhost:3000/auth/me
Authorization: Bearer <access_token>

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    ...
  }
}
*/

// ============================================
// 4. UPDATE USER PROFILE
// ============================================
/*
PATCH http://localhost:3000/auth/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "Johnny",
  "companyName": "New Tech Corp"
}

Response:
{
  "success": true,
  "message": "User updated successfully",
  "data": { ... }
}
*/

// ============================================
// 5. REFRESH ACCESS TOKEN
// ============================================
/*
POST http://localhost:3000/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}

Response:
{
  "success": true,
  "data": {
    "accessToken": "new_access_token_here"
  }
}
*/

// ============================================
// 6. CHANGE PASSWORD
// ============================================
/*
POST http://localhost:3000/auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "oldPassword": "SecurePass123!",
  "newPassword": "NewSecurePass456!"
}

Response:
{
  "success": true,
  "message": "Password changed successfully. Please login again."
}
*/

// ============================================
// 7. LOGOUT
// ============================================
/*
POST http://localhost:3000/auth/logout
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}

Response:
{
  "success": true,
  "message": "Logged out successfully"
}
*/

// ============================================
// 8. LOGOUT FROM ALL DEVICES
// ============================================
/*
POST http://localhost:3000/auth/logout-all
Authorization: Bearer <access_token>

Response:
{
  "success": true,
  "message": "Logged out from all devices"
}
*/

// ============================================
// 9. VERIFY TOKEN
// ============================================
/*
POST http://localhost:3000/auth/verify
Content-Type: application/json

{
  "token": "<access_token>"
}

Response:
{
  "success": true,
  "valid": true,
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "iat": 1699268400,
    "exp": 1699269300
  }
}


// ============================================
// CURL EXAMPLES
// ============================================

// Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","firstName":"Test"}'

// Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

// Get profile (replace TOKEN with actual access token)
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer TOKEN"

// ============================================
// JAVASCRIPT FETCH EXAMPLES
// ============================================

// Register
fetch('http://localhost:3000/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe'
  })
})
.then(res => res.json())
.then(data => console.log(data));

// Login and store tokens
fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
})
.then(res => res.json())
.then(data => {
  localStorage.setItem('accessToken', data.data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
});

// Authenticated request
const accessToken = localStorage.getItem('accessToken');
fetch('http://localhost:3000/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
.then(res => res.json())
.then(data => console.log(data));
*/