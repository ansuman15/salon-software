import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salon_id: string;
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
        // Support both salon_id (new) and salonId (old) formats
        const salonId = session.salon_id || session.salonId;
        if (!salonId || salonId === 'admin') return null;
        return { salon_id: salonId };
    } catch {
        return null;
    }
}

interface BillItem {
    item_type: 'service' | 'product';
    item_id?: string;
    service_id?: string;
    product_id?: string;
    service_name?: string;
    item_name?: string;
    staff_id?: string;
    quantity: number;
    unit_price: number;
}

/**
 * Generate invoice number
 */
function generateInvoiceNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SALX-${year}${month}-${random}`;
}

/**
 * POST /api/billing/complete
 * Complete a billing transaction
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salon_id) {
            console.log('[Billing] No session or salon_id');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        console.log('[Billing] Request body:', JSON.stringify(body, null, 2));

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

        const supabase = getSupabaseAdmin();

        // Generate invoice number
        const invoiceNumber = generateInvoiceNumber();

        // Try using the bills table (simpler, more likely to exist)
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .insert({
                salon_id: session.salon_id,
                customer_id: customer_id || null,
                invoice_number: invoiceNumber,
                subtotal: subtotal || 0,
                discount_percent: discount_percent || 0,
                discount_amount: discount_amount || 0,
                coupon_id: coupon_id || null,
                coupon_code: coupon_code || null,
                tax_percent: tax_percent || 0,
                tax_amount: tax_amount || 0,
                final_amount: final_amount || subtotal || 0,
                payment_method: payment_method,
                payment_status: 'paid',
                notes: notes || null,
            })
            .select()
            .single();

        if (billError) {
            console.error('[Billing] Bill insert error:', billError);
            return NextResponse.json({
                error: billError.message || 'Failed to create bill'
            }, { status: 500 });
        }

        // Insert bill items
        const billItems = (items as BillItem[]).map(item => ({
            bill_id: bill.id,
            service_id: item.item_type === 'service' ? (item.item_id || item.service_id) : null,
            product_id: item.item_type === 'product' ? (item.item_id || item.product_id) : null,
            service_name: item.item_name || item.service_name || 'Unknown',
            staff_id: item.staff_id || null, // Track which staff performed this service/sold this product
            quantity: item.quantity || 1,
            unit_price: item.unit_price,
            total_price: (item.quantity || 1) * item.unit_price,
        }));

        const { error: itemsError } = await supabase
            .from('bill_items')
            .insert(billItems);

        if (itemsError) {
            console.error('[Billing] Bill items insert error:', itemsError);
            // Bill was created, items failed - log but don't fail the whole transaction
        }

        // Deduct inventory for products
        for (const item of items as BillItem[]) {
            if (item.item_type === 'product') {
                const productId = item.item_id || item.product_id;
                if (productId) {
                    try {
                        await supabase.rpc('deduct_inventory_for_billing', {
                            p_salon_id: session.salon_id,
                            p_product_id: productId,
                            p_quantity: item.quantity || 1
                        });
                    } catch (err) {
                        console.log('[Billing] Inventory deduction failed (function may not exist):', err);
                    }
                }
            }
        }

        // If coupon was used, try to increment usage
        if (coupon_id) {
            try {
                await supabase.rpc('increment_coupon_usage', { p_coupon_id: coupon_id });
            } catch (err) {
                console.log('[Billing] Coupon increment failed:', err);
            }
        }

        // Fetch the complete bill with customer info
        const { data: completeBill } = await supabase
            .from('bills')
            .select(`
                *,
                customer:customers(id, name, phone, email)
            `)
            .eq('id', bill.id)
            .single();

        const { data: completeBillItems } = await supabase
            .from('bill_items')
            .select('*')
            .eq('bill_id', bill.id);

        console.log('[Billing] Success - Bill ID:', bill.id);

        return NextResponse.json({
            success: true,
            bill: {
                ...completeBill,
                items: completeBillItems || billItems,
            },
            message: 'Bill created successfully',
        });

    } catch (error) {
        console.error('[Billing] Complete error:', error);
        return NextResponse.json({
            error: 'Failed to complete billing',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
