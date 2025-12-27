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
 * GET /api/products/[id]
 * Get a single product
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
        const { data, error } = await supabase
            .from('products')
            .select('*, inventory(*)')
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Product GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
    }
}

/**
 * PATCH /api/products/[id]
 * Update a product
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
        const { name, category, brand, type, unit, cost_price, selling_price, is_active, image_url } = body;

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category;
        if (brand !== undefined) updates.brand = brand;
        if (type !== undefined) {
            if (!['service_use', 'retail_sale', 'both'].includes(type)) {
                return NextResponse.json(
                    { error: 'Type must be service_use, retail_sale, or both' },
                    { status: 400 }
                );
            }
            updates.type = type;
        }
        if (unit !== undefined) updates.unit = unit;
        if (cost_price !== undefined) updates.cost_price = cost_price;
        if (selling_price !== undefined) updates.selling_price = selling_price;
        if (is_active !== undefined) updates.is_active = is_active;
        if (image_url !== undefined) updates.image_url = image_url || null;

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
            message: 'Product updated successfully'
        });
    } catch (error) {
        console.error('Product PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }
}

/**
 * DELETE /api/products/[id]
 * Soft delete (deactivate) a product
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

        // Soft delete - just deactivate
        const { data, error } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
            message: 'Product deactivated'
        });
    } catch (error) {
        console.error('Product DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }
}
