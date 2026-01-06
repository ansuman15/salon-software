/**
 * Attendance PDF Export API - Generate PDF file
 * GET /api/attendance/export/pdf?date=YYYY-MM-DD
 * GET /api/attendance/export/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 * GET /api/attendance/export/pdf?month=YYYY-MM
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import PDFDocument from 'pdfkit';

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
        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
            bufferPages: true
        });

        // Collect PDF data into buffer
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        // Title and Header
        doc.fontSize(20).font('Helvetica-Bold')
            .text(salon?.name || 'Attendance Report', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica')
            .text(`Period: ${formatDate(startDate)} to ${formatDate(endDate)}`, { align: 'center' });

        if (salon?.phone) {
            doc.text(`Phone: ${salon.phone}`, { align: 'center' });
        }
        if (salon?.city) {
            doc.text(`Location: ${salon.city}`, { align: 'center' });
        }

        doc.moveDown(1);

        // Draw separator line
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.5);

        // Table Header
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Staff Name', 'Role', 'Status', 'Check-in', 'Check-out'];
        const colWidths = [70, 130, 90, 70, 65, 65];
        let xPos = 40;

        // Header background
        doc.fillColor('#4F46E5').rect(40, tableTop - 5, 515, 20).fill();

        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
            doc.text(header, xPos + 3, tableTop, { width: colWidths[i], align: 'left' });
            xPos += colWidths[i];
        });

        doc.moveDown(1);

        // Table Rows
        doc.fillColor('#000000').font('Helvetica').fontSize(9);
        let rowY = doc.y;
        let rowCount = 0;

        for (const record of attendanceData || []) {
            // Check if we need a new page
            if (rowY > 750) {
                doc.addPage();
                rowY = 50;

                // Repeat header on new page
                xPos = 40;
                doc.fillColor('#4F46E5').rect(40, rowY - 5, 515, 20).fill();
                doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
                tableHeaders.forEach((header, i) => {
                    doc.text(header, xPos + 3, rowY, { width: colWidths[i], align: 'left' });
                    xPos += colWidths[i];
                });
                rowY += 20;
                doc.fillColor('#000000').font('Helvetica').fontSize(9);
            }

            // Alternate row background
            if (rowCount % 2 === 0) {
                doc.fillColor('#F9FAFB').rect(40, rowY - 3, 515, 18).fill();
            }
            doc.fillColor('#000000');

            // Staff data handling
            const staffData = record.staff as { name: string; role: string }[] | null;
            const staff = Array.isArray(staffData) ? staffData[0] : staffData;

            xPos = 40;
            const rowData = [
                formatDate(record.attendance_date),
                staff?.name || 'Unknown',
                staff?.role || '-',
                formatStatus(record.status),
                record.check_in_time || '-',
                record.check_out_time || '-'
            ];

            // Color status cell
            rowData.forEach((text, i) => {
                if (i === 3) {
                    // Status column with color
                    const statusColor = getStatusColor(record.status);
                    doc.fillColor(statusColor);
                }
                doc.text(text, xPos + 3, rowY, { width: colWidths[i], align: 'left' });
                if (i === 3) {
                    doc.fillColor('#000000');
                }
                xPos += colWidths[i];
            });

            rowY += 18;
            rowCount++;
        }

        // Draw bottom border
        doc.moveTo(40, rowY + 5).lineTo(555, rowY + 5).stroke();

        // Summary section
        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica-Bold').text('Summary', 40);
        doc.moveDown(0.5);

        const presentCount = attendanceData?.filter(r => r.status === 'present').length || 0;
        const absentCount = attendanceData?.filter(r => r.status === 'absent').length || 0;
        const halfDayCount = attendanceData?.filter(r => r.status === 'half_day').length || 0;
        const leaveCount = attendanceData?.filter(r => r.status === 'leave').length || 0;

        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Records: ${attendanceData?.length || 0}`, 40);
        doc.text(`Present: ${presentCount}  |  Absent: ${absentCount}  |  Half Day: ${halfDayCount}  |  Leave: ${leaveCount}`, 40);

        // Footer with generation time
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#666666')
            .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 40, doc.page.height - 50, { align: 'center', width: 515 });

        // Finalize PDF
        doc.end();

        // Wait for PDF to be completed
        await new Promise<void>((resolve) => doc.on('end', resolve));

        const pdfBuffer = Buffer.concat(chunks);

        // Return as downloadable file
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
        console.error('[Attendance PDF Export] Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
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

function getStatusColor(status: string): string {
    switch (status) {
        case 'present': return '#16A34A';
        case 'absent': return '#DC2626';
        case 'half_day': return '#D97706';
        case 'leave': return '#2563EB';
        default: return '#000000';
    }
}
