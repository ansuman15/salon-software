import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/products/[id]
 * Get a single product
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const { id } = await params;
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('products')
            .select('*, inventory(*)')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return successResponse({ data });
    } catch (error) {
        console.error('Product GET error:', error);
        return serverErrorResponse('Failed to fetch product');
    }
}

/**
 * PATCH /api/products/[id]
 * Update a product
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            console.error('[Product PATCH] No session found');
            return unauthorizedResponse();
        }

        const { id } = await params;
        console.log('[Product PATCH] Updating product:', id, 'for salon:', session.salonId);

        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('[Product PATCH] JSON parse error:', parseError);
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        console.log('[Product PATCH] Request body:', body);

        const { name, category, brand, type, unit, cost_price, selling_price, is_active, image_url } = body;

        const updates: Record<string, unknown> = {};
        if (name !== undefined) updates.name = name;
        if (category !== undefined) updates.category = category || null;
        if (brand !== undefined) updates.brand = brand || null;
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
        if (cost_price !== undefined) updates.cost_price = cost_price !== null && cost_price !== '' ? Number(cost_price) : null;
        if (selling_price !== undefined) updates.selling_price = selling_price !== null && selling_price !== '' ? Number(selling_price) : null;
        if (is_active !== undefined) updates.is_active = is_active;
        if (image_url !== undefined) updates.image_url = image_url || null;

        console.log('[Product PATCH] Updates to apply:', updates);

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // First verify the product exists and belongs to this salon
        const { data: existing, error: fetchError } = await supabase
            .from('products')
            .select('id')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (fetchError || !existing) {
            console.error('[Product PATCH] Product not found:', fetchError);
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .select()
            .single();

        if (error) {
            console.error('[Product PATCH] Supabase error:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            return NextResponse.json({
                error: error.message || 'Failed to update product',
                code: error.code,
                details: error.details,
                hint: error.hint
            }, { status: 500 });
        }

        console.log('[Product PATCH] Successfully updated product:', data.id);
        return successResponse({ data, message: 'Product updated successfully' });
    } catch (error) {
        console.error('[Product PATCH] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update product';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * DELETE /api/products/[id]
 * Permanently delete a product
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const { id } = await params;
        const supabase = getSupabaseAdmin();

        // Delete inventory records first (foreign key constraint)
        await supabase
            .from('inventory')
            .delete()
            .eq('product_id', id);

        // Permanent delete product
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('salon_id', session.salonId);

        if (error) {
            console.error('Product DELETE error:', error);
            return serverErrorResponse('Failed to delete product');
        }

        return successResponse({ deleted: true, message: 'Product deleted permanently' });
    } catch (error) {
        console.error('Product DELETE error:', error);
        return serverErrorResponse('Failed to delete product');
    }
}

