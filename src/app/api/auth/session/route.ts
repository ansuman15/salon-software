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

        // Check both cookie formats
        let sessionCookie = cookieStore.get('salon_session');
        console.log('[Session API] salon_session cookie:', sessionCookie?.value ? 'present' : 'missing');

        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salonx_session');
            console.log('[Session API] salonx_session cookie:', sessionCookie?.value ? 'present' : 'missing');
        }

        if (!sessionCookie?.value) {
            console.log('[Session API] No session cookie found');
            return NextResponse.json({ authenticated: false });
        }

        const session = JSON.parse(sessionCookie.value);
        console.log('[Session API] Session data:', JSON.stringify(session));

        // Support both salon_id (new) and salonId (old) formats
        const salonId = session.salon_id || session.salonId;
        console.log('[Session API] Resolved salonId:', salonId);

        // Check if session expired (skip for admin sessions without expiry)
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            console.log('[Session API] Session expired');
            await clearSessionCookies();
            return NextResponse.json({ authenticated: false, reason: 'Session expired' });
        }

        // Handle admin sessions (salonId = 'admin')
        if (session.isAdmin || salonId === 'admin') {
            console.log('[Session API] Admin session detected');
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
