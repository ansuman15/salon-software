import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

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

interface BillItem {
    service_id: string;
    service_name: string;
    quantity: number;
    unit_price: number;
}

/**
 * POST /api/billing/complete
 * Complete a billing transaction
 */
export async function POST(request: NextRequest) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const {
            customer_id,
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

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No items in bill' }, { status: 400 });
        }

        if (!payment_method) {
            return NextResponse.json({ error: 'Payment method is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Generate invoice number
        const { data: invoiceData } = await supabase.rpc('generate_invoice_number', {
            p_salon_id: session.salonId,
        });

        const invoiceNumber = invoiceData || `INV-${Date.now()}`;

        // Create bill
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert({
                salon_id: session.salonId,
                customer_id: customer_id || null,
                invoice_number: invoiceNumber,
                subtotal,
                discount_percent: discount_percent || 0,
                discount_amount: discount_amount || 0,
                coupon_id: coupon_id || null,
                coupon_code: coupon_code || null,
                tax_percent: tax_percent || 0,
                tax_amount: tax_amount || 0,
                final_amount,
                payment_method,
                payment_status: 'paid',
                notes: notes || null,
            })
            .select()
            .single();

        if (billError) throw billError;

        // Create bill items
        const billItems = (items as BillItem[]).map(item => ({
            bill_id: bill.id,
            service_id: item.service_id || null,
            service_name: item.service_name,
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            total_price: (item.quantity || 1) * item.unit_price,
        }));

        const { error: itemsError } = await supabase
            .from('bill_items')
            .insert(billItems);

        if (itemsError) throw itemsError;

        // Increment coupon usage if used
        if (coupon_id) {
            await supabase.rpc('increment_coupon_usage', { p_coupon_id: coupon_id });
        }

        return NextResponse.json({
            success: true,
            bill: {
                ...bill,
                items: billItems,
            },
            message: 'Payment completed successfully',
        });
    } catch (error) {
        console.error('Billing complete error:', error);
        return NextResponse.json({ error: 'Failed to complete billing' }, { status: 500 });
    }
}
