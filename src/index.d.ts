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
     * Update user
     */
    updateUser(userId: number, updates: Partial<User>): Promise<User>;

    /**
     * Change password
     */
    changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ success: boolean }>;

    /**
     * Register a hook
     */
    on(event: HookEvent, callback: HookCallback): this;

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
