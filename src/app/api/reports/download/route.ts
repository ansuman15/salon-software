/**
 * Report PDF Download API
 * GET /api/reports/download?period=week|month
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse } from '@/lib/apiAuth';
import PDFDocument from 'pdfkit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'month';

        const supabase = getSupabaseAdmin();

        // Calculate date range
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

        // Fetch salon info
        const { data: salon } = await supabase
            .from('salons')
            .select('name, phone, city')
            .eq('id', session.salonId)
            .single();

        // Fetch bills for the period
        const { data: bills } = await supabase
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

        // Fetch staff performance - get bill_items linked to bills from this salon in the period
        // First get bill IDs from this period
        const billIds = (bills || []).map(b => b.id);

        let staffPerformance: { name: string; services: number; revenue: number }[] = [];

        if (billIds.length > 0) {
            const { data: billItems, error: itemsError } = await supabase
                .from('bill_items')
                .select('total_price, staff_id')
                .in('bill_id', billIds);

            if (itemsError) {
                console.error('[Report Download] Bill items error:', itemsError);
            }

            // Aggregate staff performance
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

            // Get staff names
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

        // Calculate totals
        const totalRevenue = (bills || []).reduce((sum, b) => sum + (b.final_amount || 0), 0);
        const totalBills = bills?.length || 0;
        const avgTransaction = totalBills > 0 ? totalRevenue / totalBills : 0;

        // Create PDF
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));

        // Header
        doc.fontSize(24).font('Helvetica-Bold')
            .text(salon?.name || 'SalonX', { align: 'center' });
        doc.fontSize(12).font('Helvetica')
            .text('Business Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#666666')
            .text(`Period: ${periodLabel}`, { align: 'center' });
        if (salon?.city) doc.text(`Location: ${salon.city}`, { align: 'center' });
        if (salon?.phone) doc.text(`Phone: ${salon.phone}`, { align: 'center' });

        doc.moveDown(1);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#e5e7eb');
        doc.moveDown(1);

        // Revenue Summary
        doc.fillColor('#000000').fontSize(16).font('Helvetica-Bold')
            .text('📊 Revenue Summary');
        doc.moveDown(0.5);

        const summaryY = doc.y;
        doc.fontSize(11).font('Helvetica');

        // Summary boxes
        const boxWidth = 160;
        const boxHeight = 50;
        const boxGap = 17;

        // Total Revenue Box
        doc.fillColor('#4F46E5').rect(40, summaryY, boxWidth, boxHeight).fill();
        doc.fillColor('#FFFFFF').fontSize(10).text('Total Revenue', 50, summaryY + 8);
        doc.fontSize(18).font('Helvetica-Bold').text(`₹${totalRevenue.toLocaleString('en-IN')}`, 50, summaryY + 25);

        // Total Bills Box
        doc.fillColor('#10B981').rect(40 + boxWidth + boxGap, summaryY, boxWidth, boxHeight).fill();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica').text('Total Bills', 50 + boxWidth + boxGap, summaryY + 8);
        doc.fontSize(18).font('Helvetica-Bold').text(`${totalBills}`, 50 + boxWidth + boxGap, summaryY + 25);

        // Avg Transaction Box
        doc.fillColor('#F59E0B').rect(40 + (boxWidth + boxGap) * 2, summaryY, boxWidth, boxHeight).fill();
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica').text('Avg Transaction', 50 + (boxWidth + boxGap) * 2, summaryY + 8);
        doc.fontSize(18).font('Helvetica-Bold').text(`₹${Math.round(avgTransaction).toLocaleString('en-IN')}`, 50 + (boxWidth + boxGap) * 2, summaryY + 25);

        doc.y = summaryY + boxHeight + 20;
        doc.fillColor('#000000');

        // Staff Performance Table
        if (staffPerformance.length > 0) {
            doc.moveDown(1);
            doc.fontSize(16).font('Helvetica-Bold').text('👥 Staff Performance');
            doc.moveDown(0.5);

            const tableTop = doc.y;
            const colWidths = [200, 120, 150];
            let xPos = 40;

            // Header
            doc.fillColor('#4F46E5').rect(40, tableTop - 5, 515, 22).fill();
            doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold');
            ['Staff Name', 'Services Done', 'Revenue Generated'].forEach((header, i) => {
                doc.text(header, xPos + 5, tableTop, { width: colWidths[i] });
                xPos += colWidths[i];
            });

            // Rows
            doc.fillColor('#000000').font('Helvetica').fontSize(10);
            let rowY = tableTop + 22;

            staffPerformance.slice(0, 10).forEach((staff, idx) => {
                if (idx % 2 === 0) {
                    doc.fillColor('#F9FAFB').rect(40, rowY - 3, 515, 18).fill();
                }
                doc.fillColor('#000000');
                xPos = 40;
                doc.text(staff.name, xPos + 5, rowY, { width: colWidths[0] });
                xPos += colWidths[0];
                doc.text(staff.services.toString(), xPos + 5, rowY, { width: colWidths[1] });
                xPos += colWidths[1];
                doc.text(`₹${staff.revenue.toLocaleString('en-IN')}`, xPos + 5, rowY, { width: colWidths[2] });
                rowY += 18;
            });

            doc.y = rowY + 10;
        }

        // Recent Bills Table
        if ((bills?.length || 0) > 0) {
            doc.moveDown(1);
            doc.fontSize(16).font('Helvetica-Bold').text('🧾 Recent Bills');
            doc.moveDown(0.5);

            const tableTop = doc.y;
            const colWidths = [90, 130, 100, 80, 100];
            let xPos = 40;

            // Header
            doc.fillColor('#4F46E5').rect(40, tableTop - 5, 515, 22).fill();
            doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
            ['Invoice #', 'Customer', 'Date', 'Method', 'Amount'].forEach((header, i) => {
                doc.text(header, xPos + 3, tableTop, { width: colWidths[i] });
                xPos += colWidths[i];
            });

            // Rows (last 15)
            doc.fillColor('#000000').font('Helvetica').fontSize(9);
            let rowY = tableTop + 22;

            (bills || []).slice(0, 15).forEach((bill, idx) => {
                if (rowY > 750) return; // Page break protection

                if (idx % 2 === 0) {
                    doc.fillColor('#F9FAFB').rect(40, rowY - 3, 515, 16).fill();
                }
                doc.fillColor('#000000');
                xPos = 40;

                const customer = Array.isArray(bill.customer) ? bill.customer[0] : bill.customer;
                const date = new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

                doc.text(bill.invoice_number, xPos + 3, rowY, { width: colWidths[0] });
                xPos += colWidths[0];
                doc.text((customer as { name?: string })?.name || '-', xPos + 3, rowY, { width: colWidths[1] });
                xPos += colWidths[1];
                doc.text(date, xPos + 3, rowY, { width: colWidths[2] });
                xPos += colWidths[2];
                doc.text(bill.payment_method.toUpperCase(), xPos + 3, rowY, { width: colWidths[3] });
                xPos += colWidths[3];
                doc.text(`₹${(bill.final_amount || 0).toLocaleString('en-IN')}`, xPos + 3, rowY, { width: colWidths[4] });

                rowY += 16;
            });
        }

        // Footer
        doc.fontSize(8).fillColor('#999999')
            .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 40, doc.page.height - 40, { align: 'center', width: 515 });

        doc.end();

        await new Promise<void>((resolve) => doc.on('end', resolve));
        const pdfBuffer = Buffer.concat(chunks);

        const filename = `Report_${periodLabel.replace(/\s+/g, '_')}.pdf`;

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('[Report Download] Error:', error);
        return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
    }
}
