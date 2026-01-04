import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    // Try salon_session first (new format), fallback to salonx_session (old format)
    let sessionCookie = cookieStore.get('salon_session');
    if (!sessionCookie?.value) {
        sessionCookie = cookieStore.get('salonx_session');
    }
    if (!sessionCookie?.value) return null;
    try {
        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salon_id || session.salonId;
        if (!salonId || salonId === 'admin') return null;
        return { salonId };
    } catch {
        return null;
    }
}

interface BillItem {
    id: string;
    bill_id: string;
    service_id: string | null;
    product_id: string | null;
    service_name: string;
    staff_id: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
}

interface Bill {
    id: string;
    invoice_number: string;
    created_at: string;
    final_amount: number;
    payment_status: string;
    customer: { id: string; name: string } | null;
}

/**
 * GET /api/staff/[id]/metrics
 * Get real-time performance metrics for a staff member from billing data
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { id: staffId } = await params;

        if (!staffId) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get date range for this month
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        // Get all paid bills for this salon
        const { data: bills, error: billsError } = await supabase
            .from('bills')
            .select(`
                id,
                invoice_number,
                created_at,
                final_amount,
                payment_status,
                customer:customers(id, name)
            `)
            .eq('salon_id', session.salonId)
            .eq('payment_status', 'paid')
            .gte('created_at', monthAgo.toISOString())
            .order('created_at', { ascending: false });

        if (billsError) {
            console.error('[Staff Metrics] Bills error:', billsError);
        }

        const billIds = (bills || []).map(b => b.id);

        // Get bill items where this staff performed services or sold products
        let staffBillItems: BillItem[] = [];
        if (billIds.length > 0) {
            const { data: items, error: itemsError } = await supabase
                .from('bill_items')
                .select('*')
                .in('bill_id', billIds)
                .eq('staff_id', staffId);

            if (itemsError) {
                console.error('[Staff Metrics] Bill items error:', itemsError);
            }
            staffBillItems = items || [];
        }

        // Calculate metrics from bill items
        let servicesPerformed = 0;
        let productsSold = 0;
        let revenueGenerated = 0;
        const serviceBillIds = new Set<string>();

        staffBillItems.forEach((item: BillItem) => {
            if (item.service_id) {
                servicesPerformed += item.quantity || 1;
                serviceBillIds.add(item.bill_id);
            }
            if (item.product_id) {
                productsSold += item.quantity || 1;
            }
            revenueGenerated += item.total_price || 0;
        });

        // Get recent bills/invoices where this staff performed services
        const recentBillIds = Array.from(serviceBillIds).slice(0, 5);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recentInvoices = (bills || [])
            .filter((b: { id: string }) => recentBillIds.includes(b.id))
            .slice(0, 5)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((b: any) => ({
                id: b.id,
                invoice_number: b.invoice_number,
                total_amount: b.final_amount,
                created_at: b.created_at,
                customer: Array.isArray(b.customer) ? b.customer[0] : b.customer,
            }));

        // Get appointment count for this staff
        const { count: appointmentCount } = await supabase
            .from('appointments')
            .select('*', { count: 'exact', head: true })
            .eq('salon_id', session.salonId)
            .eq('staff_id', staffId)
            .eq('status', 'completed');

        return NextResponse.json({
            success: true,
            metrics: {
                staff_id: staffId,
                bills_created: serviceBillIds.size, // Bills where staff performed services
                services_performed: servicesPerformed,
                products_sold: productsSold,
                revenue_generated: Math.round(revenueGenerated * 100) / 100,
                total_items_handled: staffBillItems.length,
                appointments_completed: appointmentCount || 0,
            },
            recent_invoices: recentInvoices,
        });
    } catch (error) {
        console.error('[Staff Metrics] Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch staff metrics',
            metrics: {
                staff_id: '',
                bills_created: 0,
                services_performed: 0,
                products_sold: 0,
                revenue_generated: 0,
                total_items_handled: 0,
                appointments_completed: 0,
            },
            recent_invoices: []
        }, { status: 500 });
    }
}
