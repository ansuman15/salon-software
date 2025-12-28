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
    { params }: { params: { id: string } }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
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
    { params }: { params: { id: string } }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
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

        if (error) {
            console.error('Product PATCH error:', error);
            return serverErrorResponse('Failed to update product');
        }

        return successResponse({ data, message: 'Product updated successfully' });
    } catch (error) {
        console.error('Product PATCH error:', error);
        return serverErrorResponse('Failed to update product');
    }
}

/**
 * DELETE /api/products/[id]
 * Permanently delete a product
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const supabase = getSupabaseAdmin();

        // Delete inventory records first (foreign key constraint)
        await supabase
            .from('inventory')
            .delete()
            .eq('product_id', params.id);

        // Permanent delete product
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', params.id)
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

