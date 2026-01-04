import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getApiSession } from '@/lib/sessionHelper';

export const dynamic = 'force-dynamic';

// Configuration
const LOCK_THRESHOLD_DAYS = 30; // Records older than this cannot be edited by non-admins

// Attendance status enum for validation
const VALID_STATUSES = ['present', 'absent', 'half_day', 'leave'] as const;
type AttendanceStatus = typeof VALID_STATUSES[number];

interface AttendanceRecord {
    staff_id: string;
    attendance_date: string;
    status: AttendanceStatus;
    check_in_time?: string | null;
    check_out_time?: string | null;
    notes?: string | null;
}

/**
 * GET /api/attendance?date=YYYY-MM-DD
 * Fetch attendance records for a specific date
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const staffId = searchParams.get('staff_id');
        const month = searchParams.get('month'); // YYYY-MM format for monthly view

        const session = await getApiSession();
        if (!session?.salonId) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Monthly summary query
        if (month && staffId) {
            const [year, monthNum] = month.split('-').map(Number);
            const startDate = `${month}-01`;
            const lastDay = new Date(year, monthNum, 0).getDate();
            const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('salon_id', session.salonId)
                .eq('staff_id', staffId)
                .gte('attendance_date', startDate)
                .lte('attendance_date', endDate)
                .order('attendance_date', { ascending: true });

            if (error) {
                console.error('Error fetching monthly attendance:', error);
                return NextResponse.json(
                    { error: 'Failed to fetch attendance' },
                    { status: 500 }
                );
            }

            // Calculate summary
            const summary = {
                total_present_days: data.filter(r => r.status === 'present').length,
                total_half_days: data.filter(r => r.status === 'half_day').length,
                total_absent_days: data.filter(r => r.status === 'absent').length,
                total_leave_days: data.filter(r => r.status === 'leave').length,
                records: data,
            };

            return NextResponse.json({ data: summary });
        }

        // Daily attendance query
        if (!date) {
            return NextResponse.json(
                { error: 'Date parameter is required' },
                { status: 400 }
            );
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json(
                { error: 'Invalid date format. Use YYYY-MM-DD' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('salon_id', session.salonId)
            .eq('attendance_date', date)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching attendance:', error);
            return NextResponse.json(
                { error: 'Failed to fetch attendance' },
                { status: 500 }
            );
        }

        // Check if records are locked (older than threshold)
        const today = new Date();
        const recordDate = new Date(date);
        const daysDiff = Math.floor((today.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
        const isLocked = daysDiff > LOCK_THRESHOLD_DAYS;

        return NextResponse.json({
            data,
            isLocked,
            lockThreshold: LOCK_THRESHOLD_DAYS,
        });
    } catch (error) {
        console.error('Attendance GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/attendance
 * Upsert attendance records (idempotent)
 * Body: { records: AttendanceRecord[], confirmPastEdit?: boolean }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { records, confirmPastEdit } = body as {
            records: AttendanceRecord[];
            confirmPastEdit?: boolean;
        };

        if (!records || !Array.isArray(records) || records.length === 0) {
            return NextResponse.json(
                { error: 'Records array is required' },
                { status: 400 }
            );
        }

        const session = await getApiSession();
        if (!session?.salonId) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        const isAdmin = session.isAdmin || false;
        const today = new Date().toISOString().split('T')[0];

        // Validate each record
        for (const record of records) {
            // Validate required fields
            if (!record.staff_id || !record.attendance_date || !record.status) {
                return NextResponse.json(
                    { error: 'Each record must have staff_id, attendance_date, and status' },
                    { status: 400 }
                );
            }

            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(record.attendance_date)) {
                return NextResponse.json(
                    { error: 'Invalid date format. Use YYYY-MM-DD' },
                    { status: 400 }
                );
            }

            // Block future dates
            if (record.attendance_date > today) {
                return NextResponse.json(
                    { error: 'Cannot mark attendance for future dates' },
                    { status: 400 }
                );
            }

            // Check lock threshold for non-admins
            if (!isAdmin) {
                const recordDate = new Date(record.attendance_date);
                const todayDate = new Date(today);
                const daysDiff = Math.floor((todayDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));

                if (daysDiff > LOCK_THRESHOLD_DAYS) {
                    return NextResponse.json(
                        { error: `Cannot edit attendance older than ${LOCK_THRESHOLD_DAYS} days` },
                        { status: 400 }
                    );
                }

                // Require confirmation for past edits (not today)
                if (record.attendance_date < today && !confirmPastEdit) {
                    return NextResponse.json(
                        { error: 'Past date edit requires confirmation', requireConfirmation: true },
                        { status: 400 }
                    );
                }
            }

            // Validate status
            if (!VALID_STATUSES.includes(record.status)) {
                return NextResponse.json(
                    { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
                    { status: 400 }
                );
            }
        }

        // Prepare records with salon_id
        const recordsWithSalon = records.map(r => ({
            salon_id: session.salonId,
            staff_id: r.staff_id,
            attendance_date: r.attendance_date,
            status: r.status,
            check_in_time: r.check_in_time || null,
            check_out_time: r.check_out_time || null,
            notes: r.notes || null,
            admin_override: isAdmin,
        }));

        const supabase = getSupabaseAdmin();

        // Check for locked records first
        const dates = Array.from(new Set(records.map(r => r.attendance_date)));
        const staffIds = Array.from(new Set(records.map(r => r.staff_id)));

        const { data: existingRecords } = await supabase
            .from('attendance')
            .select('id, staff_id, attendance_date, is_locked')
            .eq('salon_id', session.salonId)
            .in('staff_id', staffIds)
            .in('attendance_date', dates);

        const lockedRecords = existingRecords?.filter(r => r.is_locked) || [];
        if (lockedRecords.length > 0 && !isAdmin) {
            return NextResponse.json(
                { error: 'Some records are locked and cannot be edited' },
                { status: 400 }
            );
        }

        // Use upsert with ON CONFLICT for idempotent writes
        const { data, error } = await supabase
            .from('attendance')
            .upsert(recordsWithSalon, {
                onConflict: 'staff_id,attendance_date',
                ignoreDuplicates: false
            })
            .select();

        if (error) {
            console.error('Error upserting attendance:', error);
            return NextResponse.json(
                { error: 'Failed to save attendance' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data,
            message: `Saved attendance for ${data.length} staff members`
        });
    } catch (error) {
        console.error('Attendance POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
