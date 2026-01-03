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

interface BillItem {
    item_type: 'service' | 'product';
    item_id?: string;       // service_id or product_id
    service_id?: string;    // Legacy support
    product_id?: string;    // Legacy support
    service_name?: string;  // Legacy support
    item_name?: string;
    staff_id?: string;      // Required for services
    quantity: number;
    unit_price: number;
}

/**
 * POST /api/billing/complete
 * Complete a billing transaction using atomic database function
 * Now with staff attribution: billed_by_staff_id and staff_id per service
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Get idempotency key from header
        const idempotencyKey = request.headers.get('X-Idempotency-Key') || null;

        const body = await request.json();
        const {
            customer_id,
            billed_by_staff_id,
            items,
            subtotal,
            discount_percent,
            discount_amount,
            coupon_id,
            coupon_code,
            tax_percent,
            tax_amount,
            final_amount,
            payment_method,
            notes,
        } = body;

        // Validate required fields
        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No items in bill' }, { status: 400 });
        }

        if (!payment_method) {
            return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
        }

        if (!billed_by_staff_id) {
            return NextResponse.json({ error: 'Biller (staff) is required' }, { status: 400 });
        }

        // Validate service items have staff_id
        const serviceItemsWithoutStaff = (items as BillItem[]).filter(
            item => (item.item_type === 'service' || item.service_id) && !item.staff_id
        );
        if (serviceItemsWithoutStaff.length > 0) {
            return NextResponse.json({
                error: 'All services must have a staff member assigned'
            }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Transform items to JSONB format expected by database function
        const itemsJsonb = (items as BillItem[]).map(item => ({
            item_type: item.item_type || (item.service_id ? 'service' : 'product'),
            item_id: item.item_id || item.service_id || item.product_id,
            item_name: item.item_name || item.service_name || 'Unknown',
            staff_id: item.staff_id || null,
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
        }));

        // Call atomic billing function
        const { data, error } = await supabase.rpc('create_invoice_atomic', {
            p_salon_id: session.salonId,
            p_customer_id: customer_id || null,
            p_billed_by_staff_id: billed_by_staff_id,
            p_subtotal: subtotal || 0,
            p_discount_percent: discount_percent || 0,
            p_discount_amount: discount_amount || 0,
            p_coupon_id: coupon_id || null,
            p_coupon_code: coupon_code || null,
            p_tax_percent: tax_percent || 0,
            p_tax_amount: tax_amount || 0,
            p_total_amount: final_amount,
            p_payment_method: payment_method,
            p_idempotency_key: idempotencyKey,
            p_notes: notes || null,
            p_items: itemsJsonb,
        });

        if (error) {
            console.error('Atomic billing error:', error);
            return NextResponse.json({ error: error.message || 'Failed to complete billing' }, { status: 500 });
        }

        const result = data?.[0] || data;

        if (!result?.success) {
            return NextResponse.json({
                error: result?.message || 'Failed to create invoice'
            }, { status: 400 });
        }

        // Fetch complete invoice with staff details for response
        const { data: invoice } = await supabase
            .from('invoices')
            .select(`
                *,
                customer:customers(id, name, phone, email),
                billed_by:staff!billed_by_staff_id(id, name)
            `)
            .eq('id', result.invoice_id)
            .single();

        const { data: invoiceItems } = await supabase
            .from('invoice_items')
            .select(`
                *,
                performing_staff:staff!staff_id(id, name)
            `)
            .eq('invoice_id', result.invoice_id);

        return NextResponse.json({
            success: true,
            bill: {
                id: result.invoice_id,
                invoice_number: result.invoice_number,
                ...invoice,
                items: invoiceItems,
            },
            message: result.message,
        });
    } catch (error) {
        console.error('Billing complete error:', error);
        return NextResponse.json({ error: 'Failed to complete billing' }, { status: 500 });
    }
}
