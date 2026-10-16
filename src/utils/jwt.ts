// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../models/user.model';

/**
 * Generate JWT token
 */
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as any,
  });
};

/**
 * Verify JWT token — throw error kalau invalid
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
};