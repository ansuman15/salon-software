import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

interface AdminSessionData {
    email: string;
    isAdmin: boolean;
}

/**
 * Verify admin session from cookie
 */
function getAdminSession(): AdminSessionData | null {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('salonx_admin_session');

    if (!sessionCookie) return null;

    try {
        const session = JSON.parse(sessionCookie.value);
        if (!session.isAdmin) return null;
        return session;
    } catch {
        return null;
    }
}

/**
 * GET /api/admin/attendance?salon_id=xxx&date=YYYY-MM-DD
 * Admin: Fetch attendance for any salon
 */
export async function GET(request: NextRequest) {
    try {
        const adminSession = getAdminSession();
        if (!adminSession) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const salonId = searchParams.get('salon_id');
        const date = searchParams.get('date');
        const staffId = searchParams.get('staff_id');
        const month = searchParams.get('month');

        if (!salonId) {
            return NextResponse.json(
                { error: 'salon_id is required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Monthly summary for a staff member
        if (month && staffId) {
            const [year, monthNum] = month.split('-').map(Number);
            const startDate = `${month}-01`;
            const lastDay = new Date(year, monthNum, 0).getDate();
            const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('salon_id', salonId)
                .eq('staff_id', staffId)
                .gte('attendance_date', startDate)
                .lte('attendance_date', endDate)
                .order('attendance_date', { ascending: true });

            if (error) throw error;

            const summary = {
                total_present_days: data.filter(r => r.status === 'present').length,
                total_half_days: data.filter(r => r.status === 'half_day').length,
                total_absent_days: data.filter(r => r.status === 'absent').length,
                total_leave_days: data.filter(r => r.status === 'leave').length,
                records: data,
            };

            return NextResponse.json({ data: summary });
        }

        // Daily attendance
        if (!date) {
            return NextResponse.json(
                { error: 'date is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                staff:staff_id (id, name, role)
            `)
            .eq('salon_id', salonId)
            .eq('attendance_date', date)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Admin attendance GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/attendance
 * Admin: Override attendance (with audit logging)
 */
export async function POST(request: NextRequest) {
    try {
        const adminSession = getAdminSession();
        if (!adminSession) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            salon_id,
            staff_id,
            attendance_date,
            status,
            check_in_time,
            check_out_time,
            notes,
            admin_notes,
        } = body;

        if (!salon_id || !staff_id || !attendance_date || !status) {
            return NextResponse.json(
                { error: 'salon_id, staff_id, attendance_date, and status are required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Get existing record for audit
        const { data: existing } = await supabase
            .from('attendance')
            .select('*')
            .eq('staff_id', staff_id)
            .eq('attendance_date', attendance_date)
            .single();

        // Perform upsert (admin can override even locked records)
        const { data, error } = await supabase
            .from('attendance')
            .upsert({
                salon_id,
                staff_id,
                attendance_date,
                status,
                check_in_time: check_in_time || null,
                check_out_time: check_out_time || null,
                notes: notes || null,
                admin_override: true,
                admin_notes: admin_notes || null,
            }, {
                onConflict: 'staff_id,attendance_date'
            })
            .select()
            .single();

        if (error) throw error;

        // Create audit log entry
        await supabase
            .from('attendance_audit_log')
            .insert({
                attendance_id: data.id,
                salon_id,
                staff_id,
                attendance_date,
                action: existing ? 'admin_override' : 'create',
                old_status: existing?.status || null,
                new_status: status,
                notes: `Admin override by ${adminSession.email}. ${admin_notes || ''}`,
            });

        return NextResponse.json({
            success: true,
            data,
            message: 'Attendance updated by admin'
        });
    } catch (error) {
        console.error('Admin attendance POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/attendance/lock
 * Admin: Lock/unlock attendance records for payroll
 */
export async function PATCH(request: NextRequest) {
    try {
        const adminSession = getAdminSession();
        if (!adminSession) {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { salon_id, year, month, lock } = body;

        if (!salon_id || !year || !month || lock === undefined) {
            return NextResponse.json(
                { error: 'salon_id, year, month, and lock are required' },
                { status: 400 }
            );
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('attendance')
            .update({
                is_locked: lock,
                locked_at: lock ? new Date().toISOString() : null,
            })
            .eq('salon_id', salon_id)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .select();

        if (error) throw error;

        // Create audit log
        await supabase
            .from('attendance_audit_log')
            .insert({
                salon_id,
                staff_id: '00000000-0000-0000-0000-000000000000', // placeholder
                attendance_date: startDate,
                action: lock ? 'lock' : 'unlock',
                notes: `Admin ${lock ? 'locked' : 'unlocked'} attendance for ${year}-${month} (${data.length} records)`,
            });

        return NextResponse.json({
            success: true,
            count: data.length,
            message: `${lock ? 'Locked' : 'Unlocked'} ${data.length} attendance records`
        });
    } catch (error) {
        console.error('Admin attendance PATCH error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
