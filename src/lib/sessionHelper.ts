/**
 * Session Helper - Unified session management for all API routes
 * Supports both salon_session (new) and salonx_session (old) cookie formats
 */

import { cookies } from 'next/headers';

export interface ApiSession {
    salonId: string;
    email?: string;
    isAdmin?: boolean;
}

/**
 * Get session from cookies - checks both cookie formats for compatibility
 * @returns ApiSession or null if not authenticated
 */
export async function getApiSession(): Promise<ApiSession | null> {
    try {
        const cookieStore = await cookies();

        // Try salon_session first (new format)
        let sessionCookie = cookieStore.get('salon_session');

        // Fallback to salonx_session (old format)
        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salonx_session');
        }

        if (!sessionCookie?.value) {
            return null;
        }

        const session = JSON.parse(sessionCookie.value);

        // Support both salon_id (new) and salonId (old) property names
        const salonId = session.salon_id || session.salonId;

        if (!salonId || salonId === 'admin') {
            return null;
        }

        return {
            salonId,
            email: session.email || '',
            isAdmin: session.isAdmin || false,
        };
    } catch (error) {
        console.error('[Session Helper] Error parsing session:', error);
        return null;
    }
}

/**
 * Get admin session - for admin-only routes
 */
export async function getAdminSession(): Promise<{ email: string; isAdmin: boolean } | null> {
    try {
        const cookieStore = await cookies();

        let sessionCookie = cookieStore.get('salon_session');
        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salonx_session');
        }

        if (!sessionCookie?.value) {
            return null;
        }

        const session = JSON.parse(sessionCookie.value);

        // Check for admin access
        if (session.isAdmin) {
            return { email: session.email || '', isAdmin: true };
        }

        return null;
    } catch (error) {
        console.error('[Session Helper] Admin session error:', error);
        return null;
    }
}

/**
 * Delete all session cookies (for logout)
 */
export async function clearSessionCookies(): Promise<void> {
    const cookieStore = await cookies();

    // Delete both cookie formats
    try { cookieStore.delete('salon_session'); } catch { /* ignore */ }
    try { cookieStore.delete('salonx_session'); } catch { /* ignore */ }
}
