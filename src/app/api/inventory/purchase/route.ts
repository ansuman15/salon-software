import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getApiSession } from '@/lib/sessionHelper';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inventory/purchase
 * Add stock from supplier purchase
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getApiSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { product_id, quantity, supplier_id, reason } = body;

        // Validation
        if (!product_id) {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
        }
        if (!quantity || quantity <= 0) {
            return NextResponse.json({ error: 'quantity must be greater than zero' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Call the atomic purchase function
        const { data, error } = await supabase.rpc('add_stock_purchase', {
            p_salon_id: session.salonId,
            p_product_id: product_id,
            p_quantity: quantity,
            p_supplier_id: supplier_id || null,
            p_reason: reason || 'Stock purchase',
            p_performed_by: null,
        });

        if (error) throw error;

        const result = data[0];

        if (!result.success) {
            return NextResponse.json({ error: result.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            new_quantity: result.new_quantity,
            message: result.message,
        });
    } catch (error) {
        console.error('Inventory purchase error:', error);
        return NextResponse.json({ error: 'Failed to add stock' }, { status: 500 });
    }
}
