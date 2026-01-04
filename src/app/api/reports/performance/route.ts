/**
 * Performance Reports API - Staff Performance & Top Services from Billing
 * Returns performance data calculated from actual bill_items
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function getSession() {
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

interface BillItemRow {
    id: string;
    bill_id: string;
    service_id: string | null;
    product_id: string | null;
    service_name: string;
    staff_id: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at: string;
}

interface BillRow {
    id: string;
    salon_id: string;
    created_at: string;
    payment_status: string;
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Fetch all paid bills for this salon (this month)
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);

        const { data: bills, error: billsError } = await supabase
            .from('bills')
            .select('id, salon_id, created_at, payment_status')
            .eq('salon_id', session.salonId)
            .eq('payment_status', 'paid')
            .gte('created_at', monthAgo.toISOString());

        if (billsError) {
            console.error('[Performance API] Bills error:', billsError);
            return NextResponse.json({
                topServices: [],
                staffPerformance: [],
                error: 'Failed to fetch billing data'
            });
        }

        if (!bills || bills.length === 0) {
            return NextResponse.json({
                topServices: [],
                staffPerformance: []
            });
        }

        const billIds = bills.map((b: BillRow) => b.id);

        // Fetch all bill items for these bills
        const { data: billItems, error: itemsError } = await supabase
            .from('bill_items')
            .select('*')
            .in('bill_id', billIds);

        if (itemsError) {
            console.error('[Performance API] Bill items error:', itemsError);
            return NextResponse.json({
                topServices: [],
                staffPerformance: [],
                error: 'Failed to fetch bill items'
            });
        }

        // Debug: Check what data we got
        console.log('[Performance API] Bills count:', bills.length);
        console.log('[Performance API] Bill items count:', (billItems || []).length);
        console.log('[Performance API] Bill items with staff_id:',
            (billItems || []).filter((i: BillItemRow) => i.staff_id).length);
        console.log('[Performance API] Sample items:', JSON.stringify(
            (billItems || []).slice(0, 3).map((i: BillItemRow) => ({
                service_id: i.service_id,
                staff_id: i.staff_id,
                service_name: i.service_name
            })), null, 2));

        // Fetch staff data
        const { data: staffData } = await supabase
            .from('staff')
            .select('id, name')
            .eq('salon_id', session.salonId);

        const staffMap = new Map<string, string>();
        (staffData || []).forEach((s: { id: string; name: string }) => {
            staffMap.set(s.id, s.name);
        });

        // Calculate top services (only service items)
        const serviceStats: Record<string, { name: string; count: number; revenue: number }> = {};
        const staffStats: Record<string, { name: string; services: number; revenue: number }> = {};

        (billItems as BillItemRow[] || []).forEach(item => {
            // Service stats - only count items with service_id
            if (item.service_id) {
                const key = item.service_id;
                if (!serviceStats[key]) {
                    serviceStats[key] = {
                        name: item.service_name || 'Unknown',
                        count: 0,
                        revenue: 0
                    };
                }
                serviceStats[key].count += item.quantity || 1;
                serviceStats[key].revenue += item.total_price || 0;
            }

            // Staff stats - track revenue and service count
            if (item.staff_id) {
                const staffId = item.staff_id;
                if (!staffStats[staffId]) {
                    staffStats[staffId] = {
                        name: staffMap.get(staffId) || 'Unknown Staff',
                        services: 0,
                        revenue: 0
                    };
                }
                if (item.service_id) {
                    staffStats[staffId].services += item.quantity || 1;
                }
                staffStats[staffId].revenue += item.total_price || 0;
            }
        });

        // Convert to arrays and sort
        const topServices = Object.values(serviceStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const staffPerformance = Object.values(staffStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return NextResponse.json({
            topServices,
            staffPerformance,
            totalBills: bills.length,
            totalItems: (billItems || []).length,
        });

    } catch (error) {
        console.error('[Performance API] Error:', error);
        return NextResponse.json({
            topServices: [],
            staffPerformance: [],
            error: 'Failed to generate performance report'
        });
    }
}
