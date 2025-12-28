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
            console.error('[Customer DELETE] No session found');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { id } = await params;
        console.log('[Customer DELETE] Deleting customer:', id, 'for salon:', session.salonId);

        const supabase = getSupabaseAdmin();

        // Verify customer belongs to this salon
        const { data: existing, error: fetchError } = await supabase
            .from('customers')
            .select('id, name')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (fetchError) {
            console.error('[Customer DELETE] Fetch error:', fetchError);
            return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
        }

        if (!existing) {
            console.error('[Customer DELETE] Customer not found:', id);
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        console.log('[Customer DELETE] Found customer:', existing.name);

        // Delete customer - include salon_id for RLS policies
        const { error: deleteError } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('salon_id', session.salonId);

        if (deleteError) {
            console.error('[Customer DELETE] Supabase delete error:', {
                message: deleteError.message,
                code: deleteError.code,
                details: deleteError.details,
                hint: deleteError.hint
            });
            return NextResponse.json({
                error: deleteError.message || 'Failed to delete customer',
                code: deleteError.code
            }, { status: 500 });
        }

        console.log('[Customer DELETE] Successfully deleted:', id);
        return NextResponse.json({ success: true, message: 'Customer deleted' });

    } catch (error) {
        console.error('[Customer DELETE] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
