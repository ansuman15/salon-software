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
 * GET /api/reports/movements
 * Stock movement audit report with date range
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
        const productId = searchParams.get('product_id');
        const movementType = searchParams.get('type');
        const supplierId = searchParams.get('supplier_id');

        const supabase = getSupabaseAdmin();
        let query = supabase
            .from('stock_movements')
            .select(`
                *,
                product:products(id, name, unit),
                supplier:suppliers(id, name)
            `)
            .eq('salon_id', session.salonId)
            .order('created_at', { ascending: false });

        // Apply filters
        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate + 'T23:59:59');
        }
        if (productId) {
            query = query.eq('product_id', productId);
        }
        if (movementType) {
            query = query.eq('movement_type', movementType);
        }
        if (supplierId) {
            query = query.eq('supplier_id', supplierId);
        }

        const { data, error } = await query.limit(500);

        if (error) throw error;

        // Type definitions
        interface MovementData {
            id: string;
            created_at: string;
            movement_type: string;
            quantity_change: number;
            quantity_before: number | null;
            quantity_after: number | null;
            reference_type: string | null;
            reason: string | null;
            product: { id: string; name: string; unit: string } | null;
            supplier: { id: string; name: string } | null;
        }

        const movements = data as unknown as MovementData[];

        // Transform for report
        const report = movements.map(m => ({
            id: m.id,
            date: m.created_at,
            product_name: m.product?.name,
            product_unit: m.product?.unit,
            movement_type: m.movement_type,
            quantity_change: m.quantity_change,
            quantity_before: m.quantity_before,
            quantity_after: m.quantity_after,
            supplier_name: m.supplier?.name,
            reference_type: m.reference_type,
            reason: m.reason,
        }));

        // Calculate summary
        const summary = {
            total_movements: report.length,
            purchases: movements.filter(m => m.movement_type === 'purchase').reduce((sum, m) => sum + m.quantity_change, 0),
            deductions: Math.abs(movements.filter(m => m.movement_type === 'billing_deduction').reduce((sum, m) => sum + m.quantity_change, 0)),
            adjustments: movements.filter(m => m.movement_type === 'manual_adjustment').reduce((sum, m) => sum + m.quantity_change, 0),
        };

        return NextResponse.json({ data: report, summary });
    } catch (error) {
        console.error('Movements report error:', error);
        return NextResponse.json({ error: 'Failed to generate movements report' }, { status: 500 });
    }
}
