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
 * GET /api/reports/suppliers
 * Supplier purchase report
 */
export async function GET(request: NextRequest) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const supplierId = searchParams.get('supplier_id');

        const supabase = getSupabaseAdmin();

        // Get all purchases
        let query = supabase
            .from('stock_movements')
            .select(`
                *,
                product:products(id, name, unit, cost_price),
                supplier:suppliers(id, name, contact_person, phone)
            `)
            .eq('salon_id', session.salonId)
            .eq('movement_type', 'purchase')
            .not('supplier_id', 'is', null)
            .order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate + 'T23:59:59');
        }
        if (supplierId) {
            query = query.eq('supplier_id', supplierId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Type definitions for the response
        interface PurchaseData {
            supplier_id: string;
            quantity_change: number;
            product: { id: string; name: string; unit: string; cost_price: number | null } | null;
            supplier: { id: string; name: string; contact_person: string | null; phone: string | null } | null;
        }

        const purchases = data as unknown as PurchaseData[];

        // Group by supplier
        const supplierMap = new Map<string, {
            supplier_id: string;
            supplier_name: string;
            contact_person: string | null;
            phone: string | null;
            total_purchases: number;
            total_quantity: number;
            total_value: number;
            products: Array<{
                product_name: string;
                quantity: number;
                cost: number;
            }>;
        }>();

        for (const m of purchases) {
            if (!m.supplier) continue;

            const key = m.supplier_id;
            if (!supplierMap.has(key)) {
                supplierMap.set(key, {
                    supplier_id: m.supplier_id,
                    supplier_name: m.supplier.name,
                    contact_person: m.supplier.contact_person,
                    phone: m.supplier.phone,
                    total_purchases: 0,
                    total_quantity: 0,
                    total_value: 0,
                    products: [],
                });
            }

            const entry = supplierMap.get(key)!;
            entry.total_purchases++;
            entry.total_quantity += m.quantity_change;
            const cost = (m.product?.cost_price || 0) * m.quantity_change;
            entry.total_value += cost;
            entry.products.push({
                product_name: m.product?.name || 'Unknown',
                quantity: m.quantity_change,
                cost,
            });
        }

        const report = Array.from(supplierMap.values())
            .sort((a, b) => b.total_value - a.total_value);

        const summary = {
            total_suppliers: report.length,
            total_purchases: report.reduce((sum, r) => sum + r.total_purchases, 0),
            total_quantity: report.reduce((sum, r) => sum + r.total_quantity, 0),
            total_value: report.reduce((sum, r) => sum + r.total_value, 0),
        };

        return NextResponse.json({ data: report, summary });
    } catch (error) {
        console.error('Suppliers report error:', error);
        return NextResponse.json({ error: 'Failed to generate suppliers report' }, { status: 500 });
    }
}
