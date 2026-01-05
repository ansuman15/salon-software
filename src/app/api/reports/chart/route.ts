/**
 * Chart Data API for Reports
 * GET /api/reports/chart?period=daily|monthly&days=30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse, serverErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

interface DailyData {
    date: string;
    revenue: number;
    bills: number;
}

interface MonthlyData {
    month: string;
    revenue: number;
    bills: number;
}

export async function GET(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'daily';
        const days = parseInt(searchParams.get('days') || '30');

        const supabase = getSupabaseAdmin();

        if (period === 'daily') {
            // Get last N days of data
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);

            const { data: bills, error } = await supabase
                .from('bills')
                .select('final_amount, created_at')
                .eq('salon_id', session.salonId)
                .eq('payment_status', 'paid')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[Chart API] Error:', error);
                return serverErrorResponse('Failed to fetch chart data');
            }

            // Aggregate by day
            const dailyMap: Record<string, { revenue: number; bills: number }> = {};

            // Initialize all days with 0
            for (let i = 0; i <= days; i++) {
                const d = new Date();
                d.setDate(d.getDate() - (days - i));
                const dateKey = d.toISOString().split('T')[0];
                dailyMap[dateKey] = { revenue: 0, bills: 0 };
            }

            // Fill in actual data
            (bills || []).forEach(bill => {
                const dateKey = bill.created_at.split('T')[0];
                if (dailyMap[dateKey]) {
                    dailyMap[dateKey].revenue += bill.final_amount || 0;
                    dailyMap[dateKey].bills += 1;
                }
            });

            const chartData: DailyData[] = Object.entries(dailyMap)
                .map(([date, data]) => ({
                    date,
                    revenue: Math.round(data.revenue * 100) / 100,
                    bills: data.bills,
                }))
                .sort((a, b) => a.date.localeCompare(b.date));

            return NextResponse.json({
                success: true,
                period: 'daily',
                data: chartData,
            });

        } else if (period === 'monthly') {
            // Get last 12 months of data
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 12);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);

            const { data: bills, error } = await supabase
                .from('bills')
                .select('final_amount, created_at')
                .eq('salon_id', session.salonId)
                .eq('payment_status', 'paid')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[Chart API] Error:', error);
                return serverErrorResponse('Failed to fetch chart data');
            }

            // Aggregate by month
            const monthlyMap: Record<string, { revenue: number; bills: number }> = {};

            // Initialize all months with 0
            for (let i = 0; i < 12; i++) {
                const d = new Date();
                d.setMonth(d.getMonth() - (11 - i));
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthlyMap[monthKey] = { revenue: 0, bills: 0 };
            }

            // Fill in actual data
            (bills || []).forEach(bill => {
                const d = new Date(bill.created_at);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (monthlyMap[monthKey]) {
                    monthlyMap[monthKey].revenue += bill.final_amount || 0;
                    monthlyMap[monthKey].bills += 1;
                }
            });

            const chartData: MonthlyData[] = Object.entries(monthlyMap)
                .map(([month, data]) => ({
                    month,
                    revenue: Math.round(data.revenue * 100) / 100,
                    bills: data.bills,
                }))
                .sort((a, b) => a.month.localeCompare(b.month));

            return NextResponse.json({
                success: true,
                period: 'monthly',
                data: chartData,
            });
        }

        return NextResponse.json({ error: 'Invalid period' }, { status: 400 });

    } catch (error) {
        console.error('[Chart API] Error:', error);
        return serverErrorResponse('Failed to fetch chart data');
    }
}
