/**
 * Session check API
 * Returns current session status
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie) {
            return NextResponse.json({ authenticated: false });
        }

        const session = JSON.parse(sessionCookie.value);

        // Check if session expired (skip for admin sessions without expiry)
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            cookieStore.delete('salonx_session');
            return NextResponse.json({ authenticated: false, reason: 'Session expired' });
        }

        // Handle admin sessions (salonId = 'admin')
        if (session.isAdmin || session.salonId === 'admin') {
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
            .select('id, name, owner_email, phone, city, logo_url, status')
            .eq('id', session.salonId)
            .single();

        if (!salon || salon.status !== 'active') {
            cookieStore.delete('salonx_session');
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
                logo_url: salon.logo_url || null,
            },
        });

    } catch (error) {
        console.error('[Session API] Error:', error);
        return NextResponse.json({ authenticated: false, reason: 'Session invalid' });
    }
}

export async function DELETE(request: NextRequest) {
    // Logout
    const cookieStore = await cookies();
    cookieStore.delete('salonx_session');
    return NextResponse.json({ success: true });
}
