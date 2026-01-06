/**
 * Attendance PDF Export API - Generate PDF file using pdf-lib
 * GET /api/attendance/export/pdf?date=YYYY-MM-DD
 * GET /api/attendance/export/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 * GET /api/attendance/export/pdf?month=YYYY-MM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
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
            const [year, mon] = month.split('-').map(Number);
            startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
            const lastDay = new Date(year, mon, 0).getDate();
            endDate = `${year}-${String(mon).padStart(2, '0')}-${lastDay}`;
        } else {
            const now = new Date();
            startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
        }

        const supabase = getSupabaseAdmin();

        // Fetch salon info
        const { data: salon } = await supabase
            .from('salons')
            .select('name, phone, city')
            .eq('id', session.salonId)
            .single();

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
            console.error('[Attendance PDF Export] Query error:', error);
            return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
        }

        // Create PDF document
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();
        let yPos = height - 50;

        // Title
        page.drawText(salon?.name || 'Attendance Report', {
            x: 50,
            y: yPos,
            size: 20,
            font: helveticaBold,
            color: rgb(0, 0, 0),
        });
        yPos -= 25;

        // Period
        page.drawText(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
        });
        yPos -= 15;

        if (salon?.phone) {
            page.drawText(`Phone: ${salon.phone}`, {
                x: 50,
                y: yPos,
                size: 10,
                font: helveticaFont,
                color: rgb(0.4, 0.4, 0.4),
            });
            yPos -= 15;
        }

        // Separator line
        yPos -= 10;
        page.drawLine({
            start: { x: 50, y: yPos },
            end: { x: width - 50, y: yPos },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        yPos -= 20;

        // Table Header
        const colWidths = [70, 130, 80, 70, 65, 65];
        const headers = ['Date', 'Staff Name', 'Role', 'Status', 'Check-in', 'Check-out'];

        // Header background
        page.drawRectangle({
            x: 50,
            y: yPos - 5,
            width: width - 100,
            height: 20,
            color: rgb(0.31, 0.27, 0.9), // Purple
        });

        let xPos = 55;
        headers.forEach((header, i) => {
            page.drawText(header, {
                x: xPos,
                y: yPos,
                size: 9,
                font: helveticaBold,
                color: rgb(1, 1, 1), // White
            });
            xPos += colWidths[i];
        });
        yPos -= 25;

        // Table Rows
        let rowCount = 0;
        for (const record of attendanceData || []) {
            // Check if we need a new page
            if (yPos < 80) {
                page = pdfDoc.addPage([595, 842]);
                yPos = height - 50;

                // Repeat header on new page
                page.drawRectangle({
                    x: 50,
                    y: yPos - 5,
                    width: width - 100,
                    height: 20,
                    color: rgb(0.31, 0.27, 0.9),
                });

                xPos = 55;
                headers.forEach((header, i) => {
                    page.drawText(header, {
                        x: xPos,
                        y: yPos,
                        size: 9,
                        font: helveticaBold,
                        color: rgb(1, 1, 1),
                    });
                    xPos += colWidths[i];
                });
                yPos -= 25;
            }

            // Alternate row background
            if (rowCount % 2 === 0) {
                page.drawRectangle({
                    x: 50,
                    y: yPos - 3,
                    width: width - 100,
                    height: 16,
                    color: rgb(0.97, 0.97, 0.98),
                });
            }

            // Staff data handling
            const staffData = record.staff as { name: string; role: string }[] | null;
            const staff = Array.isArray(staffData) ? staffData[0] : staffData;

            const rowData = [
                formatDate(record.attendance_date),
                (staff?.name || 'Unknown').substring(0, 20),
                (staff?.role || '-').substring(0, 12),
                formatStatus(record.status),
                record.check_in_time || '-',
                record.check_out_time || '-'
            ];

            xPos = 55;
            rowData.forEach((text, i) => {
                let textColor = rgb(0, 0, 0);
                if (i === 3) { // Status column
                    textColor = getStatusColor(record.status);
                }
                page.drawText(text, {
                    x: xPos,
                    y: yPos,
                    size: 8,
                    font: helveticaFont,
                    color: textColor,
                });
                xPos += colWidths[i];
            });

            yPos -= 16;
            rowCount++;
        }

        // Summary section
        yPos -= 20;
        page.drawLine({
            start: { x: 50, y: yPos },
            end: { x: width - 50, y: yPos },
            thickness: 1,
            color: rgb(0.8, 0.8, 0.8),
        });
        yPos -= 20;

        page.drawText('Summary', {
            x: 50,
            y: yPos,
            size: 12,
            font: helveticaBold,
            color: rgb(0, 0, 0),
        });
        yPos -= 20;

        const presentCount = attendanceData?.filter(r => r.status === 'present').length || 0;
        const absentCount = attendanceData?.filter(r => r.status === 'absent').length || 0;
        const halfDayCount = attendanceData?.filter(r => r.status === 'half_day').length || 0;
        const leaveCount = attendanceData?.filter(r => r.status === 'leave').length || 0;

        page.drawText(`Total Records: ${attendanceData?.length || 0}`, {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });
        yPos -= 15;

        page.drawText(`Present: ${presentCount}  |  Absent: ${absentCount}  |  Half Day: ${halfDayCount}  |  Leave: ${leaveCount}`, {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });

        // Footer
        page.drawText(`Generated on ${new Date().toLocaleString('en-IN')}`, {
            x: 50,
            y: 30,
            size: 8,
            font: helveticaFont,
            color: rgb(0.6, 0.6, 0.6),
        });

        // Generate PDF bytes
        const pdfBytes = await pdfDoc.save();
        const pdfBuffer = Buffer.from(pdfBytes);
        const filename = `Attendance_${startDate}_to_${endDate}.pdf`;

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('[Attendance PDF Export] Error:', error);
        return NextResponse.json({
            error: 'Failed to generate PDF',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

function getStatusColor(status: string) {
    switch (status) {
        case 'present': return rgb(0.09, 0.64, 0.29); // Green
        case 'absent': return rgb(0.86, 0.15, 0.15); // Red
        case 'half_day': return rgb(0.85, 0.47, 0.02); // Orange
        case 'leave': return rgb(0.15, 0.39, 0.92); // Blue
        default: return rgb(0, 0, 0);
    }
}
