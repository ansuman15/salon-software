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

        // IMPORTANT: Check salonx_session FIRST (used by admin login), then salon_session
        let sessionCookie = cookieStore.get('salonx_session');

        // Fallback to salon_session (legacy)
        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salon_session');
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

        // Check salonx_session first (used by admin login)
        let sessionCookie = cookieStore.get('salonx_session');
        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salon_session');
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
