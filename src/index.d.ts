// Type definitions for secure-node-auth
// Project: secure-node-auth
// Definitions by: Himas Rafeek

declare module 'secure-node-auth' {
  import { Router } from 'express';
  import { Pool } from 'mysql2/promise';

  export interface ConnectionConfig {
    host?: string;
    user?: string;
    password?: string;
    database?: string;
    port?: number;
    waitForConnections?: boolean;
    connectionLimit?: number;
    queueLimit?: number;
  }

  export interface JWTConfig {
    accessSecret?: string;
    refreshSecret?: string;
    accessExpiresIn?: string;
    refreshExpiresIn?: string;
  }

  export interface SecurityConfig {
    bcryptRounds?: number;
    maxLoginAttempts?: number;
    lockoutTime?: number;
    requireEmailVerification?: boolean;
    passwordMinLength?: number;
    passwordRequireUppercase?: boolean;
    passwordRequireNumbers?: boolean;
    passwordRequireSpecialChars?: boolean;
  }

  export interface TablesConfig {
    users?: string;
    refreshTokens?: string;
    loginAttempts?: string;
  }

  export interface SecureNodeAuthOptions {
    connection?: ConnectionConfig;
    jwt?: JWTConfig;
    security?: SecurityConfig;
    tables?: TablesConfig;
    autoInit?: boolean;
  }

  export interface CustomField {
    name: string;
    type: string;
    required?: boolean;
    defaultValue?: any;
    unique?: boolean;
  }

  export interface User {
    id: number;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;
  }

  export interface Tokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  }

  export interface AuthResult {
    user: User;
    tokens: Tokens;
  }

  export interface DecodedToken {
    userId: number;
    email: string;
    iat: number;
    exp: number;
  }

  export interface RegistrationData {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
  }

  export interface RouterOptions {
    prefix?: string;
    enableRateLimit?: boolean;
  }

  export type HookEvent = 
    | 'beforeRegister' 
    | 'afterRegister' 
    | 'beforeLogin' 
    | 'afterLogin'
    | 'beforeTokenRefresh'
    | 'afterTokenRefresh';

  export type HookCallback = (data: any) => Promise<void> | void;

  export class SecureNodeAuth {
    constructor(options?: SecureNodeAuthOptions);

    /**
     * Initialize the authentication system
     * Creates tables, indexes, and sets up the database
     */
    init(): Promise<void>;

    /**
     * Add custom field to user schema
     * Must be called before init()
     */
    addField(field: CustomField): this;

    /**
     * Register a new user
     */
    register(userData: RegistrationData): Promise<AuthResult>;

    /**
     * Login user
     */
    login(email: string, password: string): Promise<AuthResult>;

    /**
     * Refresh access token
     */
    refreshToken(refreshToken: string): Promise<{ accessToken: string }>;

    /**
     * Logout user (revoke refresh token)
     */
    logout(refreshToken: string): Promise<{ success: boolean }>;

    /**
     * Logout from all devices (revoke all user's refresh tokens)
     */
    logoutAll(userId: number): Promise<{ success: boolean }>;

    /**
     * Verify access token
     */
    verifyAccessToken(token: string): Promise<DecodedToken>;

    /**
     * Get user by ID
     */
    getUserById(userId: number): Promise<User | null>;

    /**
     * Get user by email
     */
    getUserByEmail(email: string): Promise<User | null>;

    /**
     * Update user
     */
    updateUser(userId: number, updates: Partial<User>): Promise<User>;

    /**
     * Update user profile (alias for updateUser)
     */
    updateProfile(userId: number, updates: Partial<User>): Promise<User>;

    /**
     * Change password
     */
    changePassword(
      userId: number,
      oldPassword: string,
      newPassword: string
    ): Promise<{ success: boolean }>;

    /**
     * Check if account is locked due to failed login attempts
     */
    isAccountLocked(email: string): Promise<boolean>;

    /**
     * Get total user count (for analytics/dashboards)
     */
    getUserCount(): Promise<number>;

    /**
     * Get raw database connection pool for advanced queries
     * Use with caution - direct pool access bypasses security checks
     */
    getPool(): Pool;

    /**
     * Clean up expired verification tokens
     */
    cleanupExpiredTokens(): Promise<number>;

    /**
     * Clean up expired login attempts
     * @param daysToKeep - Number of days to retain records (default: 30)
     */
    cleanupExpiredLoginAttempts(daysToKeep?: number): Promise<number>;

    /**
     * Clean up revoked refresh tokens
     * @param daysToKeep - Number of days to retain revoked records (default: 7)
     */
    cleanupRevokedRefreshTokens(daysToKeep?: number): Promise<number>;

    /**
     * Perform comprehensive database maintenance
     * Runs all cleanup operations in one call
     */
    performMaintenance(options?: {
      cleanupLoginAttempts?: boolean;
      loginAttemptsRetentionDays?: number;
      cleanupVerificationTokens?: boolean;
      cleanupRevokedTokens?: boolean;
      revokedTokensRetentionDays?: number;
    }): Promise<{
      loginAttemptsDeleted: number;
      verificationTokensDeleted: number;
      revokedTokensDeleted: number;
      startTime: Date;
      endTime: Date;
      duration: number;
    }>;

    /**
     * Register a hook
     */
    on(event: HookEvent, callback: HookCallback): this;

    /**
     * Send verification email to user
     * @param email - User email address
     * @param verificationUrl - Base URL for verification (e.g., 'http://localhost:3000/verify-email')
     */
    sendVerificationEmail(
      email: string,
      verificationUrl: string
    ): Promise<{
      success: boolean;
      messageId: string;
    }>;

    /**
     * Send 6-digit verification code via email (optional alternative to URL-based verification)
     * @param email - User email address
     * @param options - Optional configuration
     */
    sendVerificationCode(
      email: string,
      options?: {
        expiresInMinutes?: number;
      }
    ): Promise<{
      success: boolean;
      messageId: string;
    }>;

    /**
     * Verify email with token from URL
     * @param token - Verification token from email
     */
    verifyEmail(token: string): Promise<{
      success: boolean;
      userId: number;
      message: string;
    }>;

    /**
     * Verify email with 6-digit code
     * @param email - User email address
     * @param code - 6-digit verification code
     */
    verifyCode(
      email: string,
      code: string
    ): Promise<{
      success: boolean;
      userId: number;
      message: string;
    }>;

    /**
     * Resend verification email
     * @param email - User email address
     * @param verificationUrl - Base URL for verification
     */
    resendVerificationEmail(
      email: string,
      verificationUrl: string
    ): Promise<{
      success: boolean;
      messageId: string;
    }>;

    /**
     * Send password reset email
     * @param email - User email address
     * @param resetUrl - Base URL for password reset
     */
    sendPasswordResetEmail(
      email: string,
      resetUrl: string
    ): Promise<{
      success: boolean;
      message: string;
    }>;

    /**
     * Send 6-digit password reset code via email (optional alternative to URL-based reset)
     * @param email - User email address
     * @param options - Optional configuration
     */
    sendPasswordResetCode(
      email: string,
      options?: {
        expiresInMinutes?: number;
      }
    ): Promise<{
      success: boolean;
      messageId: string;
      message: string;
    }>;

    /**
     * Reset password with token
     * @param token - Reset token from email
     * @param newPassword - New password
     */
    resetPassword(
      token: string,
      newPassword: string
    ): Promise<{
      success: boolean;
      message: string;
    }>;

    /**
     * Reset password with 6-digit code
     * @param email - User email address
     * @param code - 6-digit reset code
     * @param newPassword - New password
     */
    resetPasswordWithCode(
      email: string,
      code: string,
      newPassword: string
    ): Promise<{
      success: boolean;
      message: string;
    }>;

    /**
     * Check if email is verified
     * @param userId - User ID
     */
    isEmailVerified(userId: number): Promise<boolean>;

    /**
     * Get Express router with auth routes
     */
    router(options?: RouterOptions): Router;

    /**
     * Get authentication middleware
     */
    middleware(): (req: any, res: any, next: any) => Promise<void>;

    /**
     * Close database connection
     */
    close(): Promise<void>;
  }

  export default SecureNodeAuth;
}
