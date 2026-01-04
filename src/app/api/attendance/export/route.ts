/**
 * Attendance Export API - Generate Excel file
 * GET /api/attendance/export?date=YYYY-MM-DD
 * GET /api/attendance/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * GET /api/attendance/export?month=YYYY-MM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
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
        const salonId = session.salon_id || session.salonId;
        if (!salonId || salonId === 'admin') return null;
        return { salonId };
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const singleDate = searchParams.get('date');
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');
        const month = searchParams.get('month');

        // Determine date range
        let startDate: string;
        let endDate: string;

        if (singleDate) {
            startDate = singleDate;
            endDate = singleDate;
        } else if (fromDate && toDate) {
            startDate = fromDate;
            endDate = toDate;
        } else if (month) {
            // Format: YYYY-MM
            const [year, mon] = month.split('-').map(Number);
            startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
            const lastDay = new Date(year, mon, 0).getDate();
            endDate = `${year}-${String(mon).padStart(2, '0')}-${lastDay}`;
        } else {
            // Default: current month
            const now = new Date();
            startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
        }

        const supabase = getSupabaseAdmin();

        // Fetch attendance with staff details
        const { data: attendanceData, error } = await supabase
            .from('attendance')
            .select(`
                attendance_date,
                status,
                check_in_time,
                check_out_time,
                notes,
                staff:staff_id (id, name, role)
            `)
            .eq('salon_id', session.salonId)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .order('attendance_date', { ascending: true });

        if (error) {
            console.error('[Attendance Export] Query error:', error);
            return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SalonX';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Attendance', {
            headerFooter: {
                firstHeader: 'Attendance Report',
            }
        });

        // Define columns
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Staff Name', key: 'staffName', width: 25 },
            { header: 'Role', key: 'role', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Check-in', key: 'checkIn', width: 12 },
            { header: 'Check-out', key: 'checkOut', width: 12 },
            { header: 'Notes', key: 'notes', width: 30 },
        ];

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' }
        };
        headerRow.alignment = { horizontal: 'center' };

        // Add data rows
        for (const record of attendanceData || []) {
            // Staff is returned as an array from supabase relation, get first element
            const staffData = record.staff as { name: string; role: string }[] | null;
            const staff = Array.isArray(staffData) ? staffData[0] : staffData;
            worksheet.addRow({
                date: record.attendance_date,
                staffName: staff?.name || 'Unknown',
                role: staff?.role || '-',
                status: formatStatus(record.status),
                checkIn: record.check_in_time || '-',
                checkOut: record.check_out_time || '-',
                notes: record.notes || '',
            });
        }

        // Style status cells with colors
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            const statusCell = row.getCell('status');
            const status = statusCell.value?.toString().toLowerCase();

            if (status === 'present') {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                statusCell.font = { color: { argb: 'FF16A34A' } };
            } else if (status === 'absent') {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                statusCell.font = { color: { argb: 'FFDC2626' } };
            } else if (status === 'half day') {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                statusCell.font = { color: { argb: 'FFD97706' } };
            } else if (status === 'leave') {
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
                statusCell.font = { color: { argb: 'FF2563EB' } };
            }
        });

        // Add borders
        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                };
            });
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Return as downloadable file
        const filename = `Attendance_${startDate}_to_${endDate}.xlsx`;

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('[Attendance Export] Error:', error);
        return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
    }
}

function formatStatus(status: string): string {
    switch (status) {
        case 'present': return 'Present';
        case 'absent': return 'Absent';
        case 'half_day': return 'Half Day';
        case 'leave': return 'Leave';
        default: return status || '-';
    }
}
