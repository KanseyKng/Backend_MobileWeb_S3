// src/models/user.model.ts

/**
 * Role yang diizinkan
 */
export type UserRole = 'USER' | 'ADMIN';

/**
 * Payload untuk JWT
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Request dengan user (setelah authMiddleware)
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Response user (TANPA password)
 */
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive?: boolean;
  createdAt?: Date;
}