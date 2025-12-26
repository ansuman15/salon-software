import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

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
 * GET /api/reports/stock
 * Current stock report with filters
 */
export async function GET(request: NextRequest) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const stockStatus = searchParams.get('status'); // 'in_stock', 'low_stock', 'out_of_stock'

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('inventory')
            .select(`
                id,
                quantity,
                reorder_level,
                updated_at,
                product:products(id, name, category, brand, unit, cost_price, selling_price, is_active)
            `)
            .eq('salon_id', session.salonId);

        if (error) throw error;

        // Define types for the response
        interface ProductData {
            id: string;
            name: string;
            category: string | null;
            brand: string | null;
            unit: string;
            cost_price: number | null;
            selling_price: number | null;
            is_active: boolean;
        }

        interface InventoryData {
            id: string;
            quantity: number;
            reorder_level: number;
            updated_at: string;
            product: ProductData | null;
        }

        // Transform and filter
        let report = (data as unknown as InventoryData[]).map(item => {
            const product = item.product;
            const status = item.quantity <= 0
                ? 'out_of_stock'
                : item.quantity <= item.reorder_level
                    ? 'low_stock'
                    : 'in_stock';

            return {
                product_id: product?.id,
                product_name: product?.name,
                category: product?.category,
                brand: product?.brand,
                unit: product?.unit,
                quantity: item.quantity,
                reorder_level: item.reorder_level,
                stock_status: status,
                cost_price: product?.cost_price,
                stock_value: (product?.cost_price || 0) * item.quantity,
                selling_price: product?.selling_price,
                potential_revenue: (product?.selling_price || 0) * item.quantity,
                last_updated: item.updated_at,
            };
        }).filter(item => item.product_name); // Only active products

        // Apply filters
        if (category) {
            report = report.filter(r => r.category === category);
        }
        if (stockStatus) {
            report = report.filter(r => r.stock_status === stockStatus);
        }

        // Calculate totals
        const summary = {
            total_products: report.length,
            total_stock_value: report.reduce((sum, r) => sum + r.stock_value, 0),
            total_potential_revenue: report.reduce((sum, r) => sum + r.potential_revenue, 0),
            out_of_stock_count: report.filter(r => r.stock_status === 'out_of_stock').length,
            low_stock_count: report.filter(r => r.stock_status === 'low_stock').length,
        };

        return NextResponse.json({ data: report, summary });
    } catch (error) {
        console.error('Stock report error:', error);
        return NextResponse.json({ error: 'Failed to generate stock report' }, { status: 500 });
    }
}
