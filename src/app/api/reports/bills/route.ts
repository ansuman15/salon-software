/**
 * Bills History API for Reports
 * GET /api/reports/bills?page=1&limit=20&from=date&to=date&search=term
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse, serverErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const search = searchParams.get('search');

        const offset = (page - 1) * limit;

        const supabase = getSupabaseAdmin();

        // Build query
        let query = supabase
            .from('bills')
            .select(`
                id,
                invoice_number,
                created_at,
                subtotal,
                discount_amount,
                tax_amount,
                final_amount,
                payment_method,
                payment_status,
                customer:customer_id (id, name, phone)
            `, { count: 'exact' })
            .eq('salon_id', session.salonId)
            .order('created_at', { ascending: false });

        // Apply date filters
        if (from) {
            query = query.gte('created_at', `${from}T00:00:00`);
        }
        if (to) {
            query = query.lte('created_at', `${to}T23:59:59`);
        }

        // Apply search filter (invoice number)
        if (search) {
            query = query.ilike('invoice_number', `%${search}%`);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: bills, count, error } = await query;

        if (error) {
            console.error('[Bills API] Error:', error);
            return serverErrorResponse('Failed to fetch bills');
        }

        // Get item counts for each bill
        const billIds = (bills || []).map(b => b.id);
        let itemCounts: Record<string, number> = {};

        if (billIds.length > 0) {
            const { data: items } = await supabase
                .from('bill_items')
                .select('bill_id')
                .in('bill_id', billIds);

            if (items) {
                items.forEach(item => {
                    itemCounts[item.bill_id] = (itemCounts[item.bill_id] || 0) + 1;
                });
            }
        }

        // Transform data
        const billsWithCounts = (bills || []).map(bill => ({
            ...bill,
            items_count: itemCounts[bill.id] || 0,
            customer: Array.isArray(bill.customer) ? bill.customer[0] : bill.customer,
        }));

        return NextResponse.json({
            success: true,
            bills: billsWithCounts,
            total: count || 0,
            page,
            limit,
            totalPages: Math.ceil((count || 0) / limit),
        });

    } catch (error) {
        console.error('[Bills API] Error:', error);
        return serverErrorResponse('Failed to fetch bills');
    }
}
