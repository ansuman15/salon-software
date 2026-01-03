import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Fetch notifications for current salon
export async function GET() {
    try {
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('salon_session');

        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let session;
        try {
            session = JSON.parse(sessionCookie.value);
        } catch {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const salonId = session.salon_id;
        if (!salonId) {
            return NextResponse.json({ error: 'No salon found' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Fetch recent notifications for this salon
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('salon_id', salonId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            // Table might not exist yet - return empty array
            console.log('[Notifications] Query error (table may not exist):', error.message);
            return NextResponse.json({ notifications: [] });
        }

        return NextResponse.json({ notifications: notifications || [] });

    } catch (error) {
        console.error('[Notifications] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PATCH: Mark notifications as read
export async function PATCH(request: NextRequest) {
    try {
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('salon_session');

        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let session;
        try {
            session = JSON.parse(sessionCookie.value);
        } catch {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const salonId = session.salon_id;
        if (!salonId) {
            return NextResponse.json({ error: 'No salon found' }, { status: 400 });
        }

        const body = await request.json();
        const supabase = getSupabaseAdmin();

        if (body.markAllRead) {
            // Mark all as read for this salon
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('salon_id', salonId)
                .eq('read', false);

            if (error) {
                console.error('[Notifications] Mark all read error:', error);
                return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
            }
        } else if (body.id) {
            // Mark single notification as read
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', body.id)
                .eq('salon_id', salonId); // Security: ensure it belongs to this salon

            if (error) {
                console.error('[Notifications] Mark read error:', error);
                return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Notifications] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST: Create a notification (internal use)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.salon_id || !body.type || !body.title) {
            return NextResponse.json({
                error: 'Missing required fields: salon_id, type, title'
            }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                salon_id: body.salon_id,
                type: body.type,
                title: body.title,
                message: body.message || null,
                read: false
            })
            .select()
            .single();

        if (error) {
            console.error('[Notifications] Create error:', error);
            return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
        }

        return NextResponse.json({ notification: data });

    } catch (error) {
        console.error('[Notifications] Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
