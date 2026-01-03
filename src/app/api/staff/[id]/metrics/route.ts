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
 * GET /api/staff/[id]/metrics
 * Get real-time performance metrics for a staff member
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const staffId = params.id;

        if (!staffId) {
            return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get staff performance metrics from view
        const { data: metrics, error: metricsError } = await supabase
            .from('staff_performance')
            .select('*')
            .eq('staff_id', staffId)
            .eq('salon_id', session.salonId)
            .single();

        if (metricsError && metricsError.code !== 'PGRST116') {
            console.error('Staff metrics error:', metricsError);
        }

        // Get recent invoices where staff was biller or performer
        const { data: recentInvoicesAsBiller } = await supabase
            .from('invoices')
            .select(`
                id,
                invoice_number,
                total_amount,
                payment_method,
                created_at,
                customer:customers(id, name)
            `)
            .eq('salon_id', session.salonId)
            .eq('billed_by_staff_id', staffId)
            .order('created_at', { ascending: false })
            .limit(5);

        // Get recent invoice items where staff performed service
        const { data: recentServices } = await supabase
            .from('invoice_items')
            .select(`
                id,
                item_type,
                item_name,
                total_price,
                created_at,
                invoice:invoices!inner(
                    id,
                    invoice_number,
                    salon_id,
                    customer:customers(id, name)
                )
            `)
            .eq('staff_id', staffId)
            .eq('invoice.salon_id', session.salonId)
            .order('created_at', { ascending: false })
            .limit(10);

        // Get appointment count
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
                bills_created: metrics?.bills_created || 0,
                services_performed: metrics?.services_performed || 0,
                products_sold: metrics?.products_sold || 0,
                revenue_generated: metrics?.revenue_generated || 0,
                total_items_handled: metrics?.total_items_handled || 0,
                appointments_completed: appointmentCount || 0,
            },
            recent_invoices: recentInvoicesAsBiller || [],
            recent_services: recentServices || [],
        });
    } catch (error) {
        console.error('Staff metrics error:', error);
        return NextResponse.json({ error: 'Failed to fetch staff metrics' }, { status: 500 });
    }
}
