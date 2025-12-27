import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');
    if (!sessionCookie) return null;
    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

/**
 * POST /api/inventory/adjust
 * Manual inventory adjustment (requires reason)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { product_id, quantity_change, reason } = body;

        // Validation
        if (!product_id) {
            return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
        }
        if (quantity_change === undefined || quantity_change === 0) {
            return NextResponse.json({ error: 'quantity_change is required and must not be zero' }, { status: 400 });
        }
        if (!reason || reason.trim() === '') {
            return NextResponse.json({ error: 'Reason is required for manual adjustment' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Call the atomic adjustment function
        const { data, error } = await supabase.rpc('adjust_inventory_manual', {
            p_salon_id: session.salonId,
            p_product_id: product_id,
            p_quantity_change: quantity_change,
            p_reason: reason,
            p_performed_by: null, // Could add user ID if available
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
        console.error('Inventory adjust error:', error);
        return NextResponse.json({ error: 'Failed to adjust inventory' }, { status: 500 });
    }
}
