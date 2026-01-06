/**
 * Report PDF Download API using pdf-lib
 * GET /api/reports/download?period=week|month
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse } from '@/lib/apiAuth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    let step = 'init';

    try {
        // Step 1: Verify session
        step = 'session';
        const session = await verifySession();
        if (!session) return unauthorizedResponse();

        console.log('[Report Download] Session verified for salon:', session.salonId);

        // Step 2: Parse params
        step = 'params';
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'month';

        // Step 3: Get Supabase client
        step = 'supabase';
        const supabase = getSupabaseAdmin();

        // Step 4: Calculate date range
        step = 'dates';
        const now = new Date();
        let startDate: Date;
        let periodLabel: string;

        if (period === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            periodLabel = 'Last 7 Days';
        } else {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            periodLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        }

        // Step 5: Fetch salon info
        step = 'fetch_salon';
        const { data: salon, error: salonError } = await supabase
            .from('salons')
            .select('name, phone, city')
            .eq('id', session.salonId)
            .single();

        if (salonError) {
            console.error('[Report Download] Salon fetch error:', salonError);
        }

        // Step 6: Fetch bills
        step = 'fetch_bills';
        const { data: bills, error: billsError } = await supabase
            .from('bills')
            .select(`
                id,
                invoice_number,
                created_at,
                final_amount,
                payment_method,
                customer:customer_id (name)
            `)
            .eq('salon_id', session.salonId)
            .eq('payment_status', 'paid')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

        if (billsError) {
            console.error('[Report Download] Bills fetch error:', billsError);
        }

        console.log('[Report Download] Fetched', bills?.length || 0, 'bills');

        // Step 7: Fetch staff performance
        step = 'fetch_staff';
        const billIds = (bills || []).map(b => b.id);
        let staffPerformance: { name: string; services: number; revenue: number }[] = [];

        if (billIds.length > 0) {
            const { data: billItems } = await supabase
                .from('bill_items')
                .select('total_price, staff_id')
                .in('bill_id', billIds);

            const staffStats: Record<string, { services: number; revenue: number }> = {};
            (billItems || []).forEach(item => {
                if (item.staff_id) {
                    if (!staffStats[item.staff_id]) {
                        staffStats[item.staff_id] = { services: 0, revenue: 0 };
                    }
                    staffStats[item.staff_id].services += 1;
                    staffStats[item.staff_id].revenue += item.total_price || 0;
                }
            });

            const staffIds = Object.keys(staffStats);
            if (staffIds.length > 0) {
                const { data: staffMembers } = await supabase
                    .from('staff')
                    .select('id, name')
                    .in('id', staffIds);

                staffPerformance = staffIds.map(id => {
                    const staff = staffMembers?.find(s => s.id === id);
                    return {
                        name: staff?.name || 'Unknown',
                        services: staffStats[id].services,
                        revenue: staffStats[id].revenue,
                    };
                }).sort((a, b) => b.revenue - a.revenue);
            }
        }

        // Step 8: Calculate totals
        step = 'calc_totals';
        const totalRevenue = (bills || []).reduce((sum, b) => sum + (b.final_amount || 0), 0);
        const totalBills = bills?.length || 0;
        const avgTransaction = totalBills > 0 ? totalRevenue / totalBills : 0;

        // Step 9: Create PDF document
        step = 'pdf_create';
        console.log('[Report Download] Creating PDF document...');
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();
        let yPos = height - 50;

        // Step 10: Draw PDF content
        step = 'pdf_draw';

        // Title
        page.drawText(salon?.name || 'SalonX', {
            x: 50,
            y: yPos,
            size: 24,
            font: helveticaBold,
            color: rgb(0, 0, 0),
        });
        yPos -= 25;

        page.drawText('Business Report', {
            x: 50,
            y: yPos,
            size: 12,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
        });
        yPos -= 20;

        page.drawText(`Period: ${periodLabel}`, {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
        });
        yPos -= 15;

        if (salon?.city) {
            page.drawText(`Location: ${salon.city}`, {
                x: 50,
                y: yPos,
                size: 10,
                font: helveticaFont,
                color: rgb(0.4, 0.4, 0.4),
            });
            yPos -= 15;
        }

        // Separator
        yPos -= 10;
        page.drawLine({
            start: { x: 50, y: yPos },
            end: { x: width - 50, y: yPos },
            thickness: 1,
            color: rgb(0.9, 0.9, 0.9),
        });
        yPos -= 25;

        // Revenue Summary Section
        page.drawText('Revenue Summary', {
            x: 50,
            y: yPos,
            size: 14,
            font: helveticaBold,
            color: rgb(0, 0, 0),
        });
        yPos -= 25;

        // Summary boxes
        const boxWidth = 160;
        const boxHeight = 50;
        const boxGap = 15;

        // Total Revenue Box
        page.drawRectangle({
            x: 50,
            y: yPos - boxHeight + 15,
            width: boxWidth,
            height: boxHeight,
            color: rgb(0.31, 0.27, 0.9),
        });
        page.drawText('Total Revenue', {
            x: 60,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(1, 1, 1),
        });
        page.drawText(`Rs ${totalRevenue.toLocaleString('en-IN')}`, {
            x: 60,
            y: yPos - 18,
            size: 16,
            font: helveticaBold,
            color: rgb(1, 1, 1),
        });

        // Total Bills Box
        page.drawRectangle({
            x: 50 + boxWidth + boxGap,
            y: yPos - boxHeight + 15,
            width: boxWidth,
            height: boxHeight,
            color: rgb(0.06, 0.73, 0.51),
        });
        page.drawText('Total Bills', {
            x: 60 + boxWidth + boxGap,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(1, 1, 1),
        });
        page.drawText(`${totalBills}`, {
            x: 60 + boxWidth + boxGap,
            y: yPos - 18,
            size: 16,
            font: helveticaBold,
            color: rgb(1, 1, 1),
        });

        // Avg Transaction Box
        page.drawRectangle({
            x: 50 + (boxWidth + boxGap) * 2,
            y: yPos - boxHeight + 15,
            width: boxWidth,
            height: boxHeight,
            color: rgb(0.96, 0.62, 0.04),
        });
        page.drawText('Avg Transaction', {
            x: 60 + (boxWidth + boxGap) * 2,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(1, 1, 1),
        });
        page.drawText(`Rs ${Math.round(avgTransaction).toLocaleString('en-IN')}`, {
            x: 60 + (boxWidth + boxGap) * 2,
            y: yPos - 18,
            size: 16,
            font: helveticaBold,
            color: rgb(1, 1, 1),
        });

        yPos -= boxHeight + 30;

        // Staff Performance Table
        if (staffPerformance.length > 0) {
            page.drawText('Staff Performance', {
                x: 50,
                y: yPos,
                size: 14,
                font: helveticaBold,
                color: rgb(0, 0, 0),
            });
            yPos -= 20;

            // Header
            page.drawRectangle({
                x: 50,
                y: yPos - 5,
                width: width - 100,
                height: 22,
                color: rgb(0.31, 0.27, 0.9),
            });

            const staffColWidths = [200, 120, 150];
            let xPos = 55;
            ['Staff Name', 'Services Done', 'Revenue Generated'].forEach((header, i) => {
                page.drawText(header, {
                    x: xPos,
                    y: yPos,
                    size: 10,
                    font: helveticaBold,
                    color: rgb(1, 1, 1),
                });
                xPos += staffColWidths[i];
            });
            yPos -= 25;

            // Staff rows
            staffPerformance.slice(0, 10).forEach((staff, idx) => {
                if (idx % 2 === 0) {
                    page.drawRectangle({
                        x: 50,
                        y: yPos - 3,
                        width: width - 100,
                        height: 18,
                        color: rgb(0.97, 0.97, 0.98),
                    });
                }

                xPos = 55;
                page.drawText(staff.name.substring(0, 30), { x: xPos, y: yPos, size: 9, font: helveticaFont, color: rgb(0, 0, 0) });
                xPos += staffColWidths[0];
                page.drawText(staff.services.toString(), { x: xPos, y: yPos, size: 9, font: helveticaFont, color: rgb(0, 0, 0) });
                xPos += staffColWidths[1];
                page.drawText(`Rs ${staff.revenue.toLocaleString('en-IN')}`, { x: xPos, y: yPos, size: 9, font: helveticaFont, color: rgb(0, 0, 0) });

                yPos -= 18;
            });

            yPos -= 15;
        }

        // Recent Bills Table
        if ((bills?.length || 0) > 0) {
            // Check if we need a new page
            if (yPos < 200) {
                page = pdfDoc.addPage([595, 842]);
                yPos = height - 50;
            }

            page.drawText('Recent Bills', {
                x: 50,
                y: yPos,
                size: 14,
                font: helveticaBold,
                color: rgb(0, 0, 0),
            });
            yPos -= 20;

            // Header
            page.drawRectangle({
                x: 50,
                y: yPos - 5,
                width: width - 100,
                height: 22,
                color: rgb(0.31, 0.27, 0.9),
            });

            const billColWidths = [90, 130, 100, 80, 100];
            let xPos = 55;
            ['Invoice #', 'Customer', 'Date', 'Method', 'Amount'].forEach((header, i) => {
                page.drawText(header, {
                    x: xPos,
                    y: yPos,
                    size: 9,
                    font: helveticaBold,
                    color: rgb(1, 1, 1),
                });
                xPos += billColWidths[i];
            });
            yPos -= 22;

            // Bill rows
            (bills || []).slice(0, 15).forEach((bill, idx) => {
                if (yPos < 50) return;

                if (idx % 2 === 0) {
                    page.drawRectangle({
                        x: 50,
                        y: yPos - 3,
                        width: width - 100,
                        height: 16,
                        color: rgb(0.97, 0.97, 0.98),
                    });
                }

                const customer = Array.isArray(bill.customer) ? bill.customer[0] : bill.customer;
                const date = new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

                xPos = 55;
                page.drawText(bill.invoice_number.substring(0, 12), { x: xPos, y: yPos, size: 8, font: helveticaFont, color: rgb(0, 0, 0) });
                xPos += billColWidths[0];
                page.drawText(((customer as { name?: string })?.name || '-').substring(0, 18), { x: xPos, y: yPos, size: 8, font: helveticaFont, color: rgb(0, 0, 0) });
                xPos += billColWidths[1];
                page.drawText(date, { x: xPos, y: yPos, size: 8, font: helveticaFont, color: rgb(0, 0, 0) });
                xPos += billColWidths[2];
                page.drawText(bill.payment_method.toUpperCase(), { x: xPos, y: yPos, size: 8, font: helveticaFont, color: rgb(0, 0, 0) });
                xPos += billColWidths[3];
                page.drawText(`Rs ${(bill.final_amount || 0).toLocaleString('en-IN')}`, { x: xPos, y: yPos, size: 8, font: helveticaFont, color: rgb(0, 0, 0) });

                yPos -= 16;
            });
        }

        // Step 11: Add footer
        step = 'pdf_footer';
        const pages = pdfDoc.getPages();
        pages.forEach(p => {
            p.drawText(`Generated on ${new Date().toLocaleString('en-IN')}`, {
                x: 50,
                y: 30,
                size: 8,
                font: helveticaFont,
                color: rgb(0.6, 0.6, 0.6),
            });
        });

        // Step 12: Save PDF
        step = 'pdf_save';
        console.log('[Report Download] Saving PDF...');
        const pdfBytes = await pdfDoc.save();
        const pdfBuffer = Buffer.from(pdfBytes);
        const filename = `Report_${periodLabel.replace(/\s+/g, '_')}.pdf`;

        console.log('[Report Download] PDF generated successfully, size:', pdfBuffer.length);

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Report Download] Error at step '${step}':`, error);
        return NextResponse.json({
            error: `Failed at ${step}: ${errorMessage}`,
            step: step
        }, { status: 500 });
    }
}

