/**
 * Individual Customer API - Update and Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper to verify session
async function verifySession() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');

    if (!sessionCookie) {
        return null;
    }

    try {
        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salonId;

        if (!salonId || salonId === 'admin') {
            return null;
        }

        return { salonId };
    } catch {
        return null;
    }
}

// PATCH - Update a customer
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const supabase = getSupabaseAdmin();

        // Verify customer belongs to this salon
        const { data: existing, error: fetchError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Update customer
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.tags !== undefined) updateData.tags = body.tags;
        if (body.gender !== undefined) updateData.gender = body.gender;

        const { data: updated, error: updateError } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[Customer API] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
        }

        // Transform to camelCase
        const customer = {
            id: updated.id,
            salonId: updated.salon_id,
            name: updated.name,
            phone: updated.phone,
            email: updated.email,
            gender: updated.gender,
            notes: updated.notes,
            tags: updated.tags || [],
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
        };

        return NextResponse.json({ success: true, customer });

    } catch (error) {
        console.error('[Customer API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete a customer
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { id } = await params;

        const supabase = getSupabaseAdmin();

        // Verify customer belongs to this salon
        const { data: existing, error: fetchError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Delete customer
        const { error: deleteError } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('[Customer API] Delete error:', deleteError);
            return NextResponse.json({ error: 'Failed to delete customer' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Customer API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
