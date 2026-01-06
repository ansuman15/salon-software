/**
 * Session check API
 * Returns current session status - supports both cookie formats
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';
import { clearSessionCookies } from '@/lib/sessionHelper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();

        // IMPORTANT: Check salonx_session FIRST (new format), then fall back to salon_session (legacy)
        // This prevents stale old cookies from interfering with new sessions
        let sessionCookie = cookieStore.get('salonx_session');
        let cookieSource = 'salonx_session';

        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salon_session');
            cookieSource = 'salon_session';
        }

        if (!sessionCookie?.value) {
            return NextResponse.json({ authenticated: false });
        }

        // Try to parse the session, if it fails, clear cookies and return unauthenticated
        let session;
        try {
            session = JSON.parse(sessionCookie.value);
        } catch (parseError) {
            console.error('[Session API] Failed to parse cookie:', parseError);
            await clearSessionCookies();
            return NextResponse.json({ authenticated: false, reason: 'Invalid session format' });
        }

        // Validate session has required fields
        const salonId = session.salon_id || session.salonId;
        if (!salonId) {
            console.error('[Session API] Session missing salonId');
            await clearSessionCookies();
            return NextResponse.json({ authenticated: false, reason: 'Invalid session' });
        }

        // Check if session expired (skip for admin sessions without expiry)
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            await clearSessionCookies();
            return NextResponse.json({ authenticated: false, reason: 'Session expired' });
        }

        // Handle admin sessions (salonId = 'admin')
        if (session.isAdmin || salonId === 'admin') {
            return NextResponse.json({
                authenticated: true,
                isAdmin: true,
                email: session.email,
                salon: {
                    id: 'admin',
                    name: session.salonName || 'SalonX Admin',
                    email: session.email,
                },
            });
        }

        // Verify salon still exists and is active, and get full data
        const supabase = getSupabaseAdmin();
        const { data: salon } = await supabase
            .from('salons')
            .select('id, name, owner_email, phone, city, address, logo_url, status, gst_percentage, gst_number, working_days, opening_time, closing_time, currency, invoice_prefix, whatsapp_enabled, whatsapp_number')
            .eq('id', salonId)
            .single();

        if (!salon || salon.status !== 'active') {
            await clearSessionCookies();
            return NextResponse.json({
                authenticated: false,
                reason: salon?.status === 'suspended' ? 'Account suspended' : 'Account not found'
            });
        }

        return NextResponse.json({
            authenticated: true,
            salon: {
                id: salon.id,
                name: salon.name,
                email: salon.owner_email,
                phone: salon.phone || '',
                city: salon.city || '',
                address: salon.address || '',
                logo_url: salon.logo_url || null,
                gst_percentage: salon.gst_percentage || 0,
                gst_number: salon.gst_number || '',
                working_days: salon.working_days || [1, 2, 3, 4, 5, 6],
                opening_time: salon.opening_time || '09:00',
                closing_time: salon.closing_time || '21:00',
                currency: salon.currency || 'INR',
                invoice_prefix: salon.invoice_prefix || 'INV',
                whatsapp_enabled: salon.whatsapp_enabled || false,
                whatsapp_number: salon.whatsapp_number || '',
            },
        });

    } catch (error) {
        console.error('[Session API] Error:', error);
        return NextResponse.json({ authenticated: false, reason: 'Session invalid' });
    }
}

export async function DELETE(request: NextRequest) {
    // Logout - delete both cookie formats
    await clearSessionCookies();
    return NextResponse.json({ success: true });
}
