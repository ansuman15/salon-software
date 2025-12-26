/**
 * Leads Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ADMIN_EMAILS } from '@/lib/config';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Verify admin access
async function verifyAdmin(): Promise<{ isAdmin: boolean; email?: string }> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');

    if (!sessionCookie) return { isAdmin: false };

    try {
        const session = JSON.parse(sessionCookie.value);
        // Check for isAdmin flag OR email in admin list
        if (session.isAdmin || ADMIN_EMAILS.includes(session.email)) {
            return { isAdmin: true, email: session.email };
        }
    } catch {
        return { isAdmin: false };
    }

    return { isAdmin: false };
}

// GET - List all leads
export async function GET() {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Leads API] Error fetching leads:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    return NextResponse.json({ leads });
}

// POST - Create new lead (from landing page)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { salonName, ownerName, email, phone, city, staffSize, requirements } = body;

        if (!salonName || !ownerName || !email || !phone) {
            return NextResponse.json(
                { error: 'Salon name, owner name, email, and phone are required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Check if lead already exists
        const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'A request with this email already exists' },
                { status: 409 }
            );
        }

        const { data: lead, error } = await supabase
            .from('leads')
            .insert({
                salon_name: salonName,
                owner_name: ownerName,
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                city: city || null,
                staff_size: staffSize || null,
                requirements: requirements || null,
                status: 'new',
            })
            .select()
            .single();

        if (error) {
            console.error('[Leads API] Error creating lead:', error);
            return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Your request has been submitted! We\'ll contact you shortly.',
            lead
        });

    } catch (error) {
        console.error('[Leads API] Error:', error);
        return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
    }
}

// PATCH - Update lead status
export async function PATCH(request: NextRequest) {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, status, notes } = await request.json();

        if (!id || !status) {
            return NextResponse.json({ error: 'ID and status required' }, { status: 400 });
        }

        const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'rejected'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('leads')
            .update({ status, notes: notes || null })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, lead: data });

    } catch (error) {
        console.error('[Leads API] PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }
}

// DELETE - Remove lead
export async function DELETE(request: NextRequest) {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Lead ID required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('leads').delete().eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
