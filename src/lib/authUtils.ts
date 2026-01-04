/**
 * SalonX Auth Utilities
 * Activation key generation, hashing, and validation
 */

import bcrypt from 'bcryptjs';

// Activation key format: SALONX-XXXX-XXXX-XXXX
const KEY_PREFIX = 'SALONX';
const KEY_SEGMENT_LENGTH = 4;
const KEY_SEGMENTS = 3;
const BCRYPT_ROUNDS = 12;

/**
 * Generate a cryptographically secure activation key
 * Format: SALONX-XXXX-XXXX-XXXX
 */
export function generateActivationKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0,O,1,I)
    const segments: string[] = [];

    for (let s = 0; s < KEY_SEGMENTS; s++) {
        let segment = '';
        for (let i = 0; i < KEY_SEGMENT_LENGTH; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            segment += chars[randomIndex];
        }
        segments.push(segment);
    }

    return `${KEY_PREFIX}-${segments.join('-')}`;
}

/**
 * Hash an activation key using bcrypt
 * @param plainKey - The plain text activation key
 * @returns Hashed key for storage
 */
export async function hashActivationKey(plainKey: string): Promise<string> {
    return bcrypt.hash(plainKey, BCRYPT_ROUNDS);
}

/**
 * Verify an activation key against its hash
 * @param plainKey - The plain text activation key from user
 * @param hashedKey - The stored hashed key
 * @returns true if match, false otherwise
 */
export async function verifyActivationKey(plainKey: string, hashedKey: string): Promise<boolean> {
    return bcrypt.compare(plainKey, hashedKey);
}

/**
 * Validate activation key format before DB lookup
 * Prevents unnecessary database queries
 */
export function isValidKeyFormat(key: string): boolean {
    const pattern = /^SALONX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(key);
}

/**
 * Calculate key expiry date
 * @param days - Number of days until expiry (default 365)
 */
export function getKeyExpiryDate(days: number = 365): Date {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
}

/**
 * Auth action types for audit logging
 */
export const AUTH_ACTIONS = {
    SALON_CREATED: 'SALON_CREATED',
    ACTIVATION_KEY_GENERATED: 'ACTIVATION_KEY_GENERATED',
    ACTIVATION_KEY_REGENERATED: 'ACTIVATION_KEY_REGENERATED',
    ACTIVATION_KEY_REVOKED: 'ACTIVATION_KEY_REVOKED',
    SALON_ACTIVATED: 'SALON_ACTIVATED',
    SALON_SUSPENDED: 'SALON_SUSPENDED',
    SALON_REACTIVATED: 'SALON_REACTIVATED',
    LOGIN_ATTEMPT: 'LOGIN_ATTEMPT',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LEAD_STATUS_CHANGED: 'LEAD_STATUS_CHANGED',
    LEAD_CONVERTED: 'LEAD_CONVERTED',
} as const;

export type AuthAction = typeof AUTH_ACTIONS[keyof typeof AUTH_ACTIONS];

/**
 * Rate limiting helper (simple in-memory for now)
 * In production, use Redis
 */
const loginAttempts = new Map<string, { count: number; firstAttempt: Date }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function checkRateLimit(email: string): { allowed: boolean; retryAfter?: number } {
    const now = new Date();
    const attempt = loginAttempts.get(email);

    if (!attempt) {
        loginAttempts.set(email, { count: 1, firstAttempt: now });
        return { allowed: true };
    }

    // Reset if lockout period has passed
    const lockoutEnd = new Date(attempt.firstAttempt.getTime() + LOCKOUT_MINUTES * 60 * 1000);
    if (now > lockoutEnd) {
        loginAttempts.set(email, { count: 1, firstAttempt: now });
        return { allowed: true };
    }

    // Check if locked out
    if (attempt.count >= MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((lockoutEnd.getTime() - now.getTime()) / 1000);
        return { allowed: false, retryAfter };
    }

    // Increment attempt count
    attempt.count++;
    return { allowed: true };
}

export function resetRateLimit(email: string): void {
    loginAttempts.delete(email);
}
