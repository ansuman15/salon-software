/**
 * Revenue Reports API - Dashboard Stats
 * Returns revenue totals for today, this week, and this month
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const cookieStore = await cookies();
        // Try salon_session first (new format), fallback to salonx_session (old format)
        let sessionCookie = cookieStore.get('salon_session');
        if (!sessionCookie?.value) {
            sessionCookie = cookieStore.get('salonx_session');
        }

        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        // Support both salon_id (new) and salonId (old) formats
        const salonId = session.salon_id || session.salonId;

        if (!salonId || salonId === 'admin') {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Get date ranges
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        // Week start (Sunday)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        // Month start
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Fetch all bills for this salon
        const { data: bills, error } = await supabase
            .from('bills')
            .select('final_amount, created_at')
            .eq('salon_id', salonId)
            .eq('payment_status', 'paid')
            .gte('created_at', monthStart)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Revenue API] Error:', error);
            // Return zeros if table doesn't exist or error
            return NextResponse.json({
                today: 0,
                week: 0,
                month: 0,
            });
        }

        // Calculate totals
        let todayTotal = 0;
        let weekTotal = 0;
        let monthTotal = 0;

        for (const bill of bills || []) {
            const billDate = new Date(bill.created_at);
            const amount = bill.final_amount || 0;

            // Month total (all bills from this month)
            monthTotal += amount;

            // Week total
            if (billDate >= weekStart) {
                weekTotal += amount;
            }

            // Today total
            if (billDate >= new Date(todayStart)) {
                todayTotal += amount;
            }
        }

        return NextResponse.json({
            today: Math.round(todayTotal * 100) / 100,
            week: Math.round(weekTotal * 100) / 100,
            month: Math.round(monthTotal * 100) / 100,
        });

    } catch (error) {
        console.error('[Revenue API] Error:', error);
        return NextResponse.json({
            today: 0,
            week: 0,
            month: 0,
        });
    }
}
