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
 * GET /api/inventory
 * Get current stock levels with optional filters
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const lowStockOnly = searchParams.get('low_stock') === 'true';
        const category = searchParams.get('category');

        const supabase = getSupabaseAdmin();

        // Get inventory with product details
        let query = supabase
            .from('inventory')
            .select(`
                *,
                product:products(id, name, category, brand, unit, cost_price, selling_price, is_active)
            `)
            .eq('salon_id', session.salonId);

        const { data, error } = await query;

        if (error) throw error;

        // Filter and transform
        let inventory = data.map(item => ({
            ...item,
            stock_status: item.quantity <= 0
                ? 'out_of_stock'
                : item.quantity <= item.reorder_level
                    ? 'low_stock'
                    : 'in_stock',
        }));

        // Apply filters
        if (lowStockOnly) {
            inventory = inventory.filter(i => i.quantity <= i.reorder_level);
        }
        if (category) {
            inventory = inventory.filter(i => i.product?.category === category);
        }

        // Calculate summary
        const summary = {
            total_products: inventory.length,
            out_of_stock: inventory.filter(i => i.stock_status === 'out_of_stock').length,
            low_stock: inventory.filter(i => i.stock_status === 'low_stock').length,
            in_stock: inventory.filter(i => i.stock_status === 'in_stock').length,
            total_value: inventory.reduce((sum, i) => {
                const value = (i.product?.cost_price || 0) * i.quantity;
                return sum + value;
            }, 0),
        };

        return NextResponse.json({ data: inventory, summary });
    } catch (error) {
        console.error('Inventory GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }
}
