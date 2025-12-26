import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

function getSession(): SessionData | null {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('salonx_session');
    if (!sessionCookie) return null;
    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

/**
 * GET /api/suppliers/[id]
 * Get supplier with purchase history
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Get supplier
        const { data: supplier, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .single();

        if (error) throw error;
        if (!supplier) {
            return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
        }

        // Get purchase history
        const { data: purchases } = await supabase
            .from('stock_movements')
            .select(`
                *,
                product:products(id, name, unit)
            `)
            .eq('supplier_id', params.id)
            .eq('movement_type', 'purchase')
            .order('created_at', { ascending: false })
            .limit(50);

        return NextResponse.json({
            data: {
                ...supplier,
                purchases: purchases || [],
            }
        });
    } catch (error) {
        console.error('Supplier GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 });
    }
}

/**
 * PATCH /api/suppliers/[id]
 * Update supplier
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { name, contact_person, phone, email, address, notes } = body;

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (contact_person !== undefined) updates.contact_person = contact_person;
        if (phone !== undefined) updates.phone = phone;
        if (email !== undefined) updates.email = email;
        if (address !== undefined) updates.address = address;
        if (notes !== undefined) updates.notes = notes;

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('suppliers')
            .update(updates)
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
            message: 'Supplier updated successfully',
        });
    } catch (error) {
        console.error('Supplier PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
    }
}

/**
 * DELETE /api/suppliers/[id]
 * Delete supplier (only if no movements)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Check if supplier has any movements
        const { data: movements } = await supabase
            .from('stock_movements')
            .select('id')
            .eq('supplier_id', params.id)
            .limit(1);

        if (movements && movements.length > 0) {
            // Soft delete - just deactivate
            const { data, error } = await supabase
                .from('suppliers')
                .update({ is_active: false })
                .eq('id', params.id)
                .eq('salon_id', session.salonId)
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({
                success: true,
                data,
                message: 'Supplier deactivated (has purchase history)',
            });
        }

        // Hard delete if no history
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', params.id)
            .eq('salon_id', session.salonId);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: 'Supplier deleted',
        });
    } catch (error) {
        console.error('Supplier DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
    }
}
