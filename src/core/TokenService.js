const jwt = require('jsonwebtoken');

/**
 * TokenService - JWT token generation and validation
 * Handles access and refresh tokens
 */
class TokenService {
  constructor(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('TokenService config is required');
    }
    
    this.accessSecret = config.accessSecret;
    this.refreshSecret = config.refreshSecret;
    this.accessExpiresIn = config.accessExpiresIn || '15m';
    this.refreshExpiresIn = config.refreshExpiresIn || '7d';

    // Validate secrets
    if (!this.accessSecret || typeof this.accessSecret !== 'string') {
      throw new Error('JWT access secret is required and must be a string');
    }
    
    if (!this.refreshSecret || typeof this.refreshSecret !== 'string') {
      throw new Error('JWT refresh secret is required and must be a string');
    }
    
    if (this.accessSecret === this.refreshSecret) {
      throw new Error('Access and refresh secrets must be different for security');
    }
    
    if (this.accessSecret.length < 32) {
      console.warn('⚠️  WARNING: JWT access secret should be at least 32 characters long');
    }
    
    if (this.accessSecret === 'change_this_secret_in_production' || 
        this.refreshSecret === 'change_this_refresh_secret_in_production') {
      console.warn('⚠️  WARNING: Using default JWT secrets. Change these in production!');
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateTokens(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }
    
    if (!payload.userId || !payload.email) {
      throw new Error('Payload must contain userId and email');
    }
    
    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresIn
    };
  }

  /**
   * Generate access token (short-lived)
   */
  async generateAccessToken(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }
    
    return new Promise((resolve, reject) => {
      jwt.sign(
        payload,
        this.accessSecret,
        { expiresIn: this.accessExpiresIn },
        (error, token) => {
          if (error) reject(error);
          else resolve(token);
        }
      );
    });
  }

  /**
   * Generate refresh token (long-lived)
   */
  async generateRefreshToken(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be an object');
    }
    
    return new Promise((resolve, reject) => {
      jwt.sign(
        payload,
        this.refreshSecret,
        { expiresIn: this.refreshExpiresIn },
        (error, token) => {
          if (error) reject(error);
          else resolve(token);
        }
      );
    });
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }
    
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.accessSecret, (error, decoded) => {
        if (error) {
          if (error.name === 'TokenExpiredError') {
            reject(new Error('Access token expired'));
          } else if (error.name === 'JsonWebTokenError') {
            reject(new Error('Invalid access token'));
          } else {
            reject(error);
          }
        } else {
          resolve(decoded);
        }
      });
    });
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }
    
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.refreshSecret, (error, decoded) => {
        if (error) {
          if (error.name === 'TokenExpiredError') {
            reject(new Error('Refresh token expired'));
          } else if (error.name === 'JsonWebTokenError') {
            reject(new Error('Invalid refresh token'));
          } else {
            reject(error);
          }
        } else {
          resolve(decoded);
        }
      });
    });
  }

  /**
   * Decode token without verification (useful for debugging)
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    return decoded ? decoded.exp : null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    const exp = this.getTokenExpiration(token);
    if (!exp) return true;
    
    return Date.now() >= exp * 1000;
  }
}

module.exports = TokenService;
