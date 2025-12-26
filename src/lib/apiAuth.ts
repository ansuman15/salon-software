/**
 * API Authentication & Security Utilities
 * Provides session verification, input sanitization, and error handling
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export interface SessionData {
    salonId: string;
    email: string;
    isAdmin: boolean;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Verify session and extract salon ID
 * Returns null if not authenticated
 */
export async function verifySession(): Promise<SessionData | null> {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie?.value) {
            return null;
        }

        const session = JSON.parse(sessionCookie.value);

        // Validate session structure
        if (!session.salonId || session.salonId === 'admin') {
            return null;
        }

        return {
            salonId: session.salonId,
            email: session.email || '',
            isAdmin: session.isAdmin || false,
        };
    } catch (error) {
        console.error('[Auth] Session verification failed:', error);
        return null;
    }
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message = 'Not authenticated') {
    return NextResponse.json(
        { success: false, error: message },
        { status: 401 }
    );
}

/**
 * Create bad request response
 */
export function badRequestResponse(message: string) {
    return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
    );
}

/**
 * Create server error response
 */
export function serverErrorResponse(message = 'Internal server error') {
    return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
    );
}

/**
 * Create success response
 */
export function successResponse<T>(data: T) {
    return NextResponse.json({ success: true, ...data });
}

/**
 * Sanitize string input - trim whitespace and prevent XSS
 */
export function sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input
        .trim()
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Sanitize and validate required string
 */
export function requireString(input: unknown, fieldName: string): { value: string; error?: string } {
    const sanitized = sanitizeString(input);
    if (!sanitized) {
        return { value: '', error: `${fieldName} is required` };
    }
    return { value: sanitized };
}

/**
 * Validate positive number
 */
export function requirePositiveNumber(input: unknown, fieldName: string): { value: number; error?: string } {
    const num = Number(input);
    if (isNaN(num) || num < 0) {
        return { value: 0, error: `${fieldName} must be a positive number` };
    }
    return { value: num };
}

/**
 * Validate array of strings
 */
export function validateStringArray(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    return input
        .filter(item => typeof item === 'string')
        .map(item => sanitizeString(item));
}
