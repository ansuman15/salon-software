import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');
    if (!sessionCookie) return null;
    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

/**
 * GET /api/billing/invoice/[id]
 * Get complete invoice data for PDF generation with staff attribution
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Try fetching from new invoices table first
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
                *,
                customer:customers(id, name, phone, email),
                billed_by:staff!billed_by_staff_id(id, name, role)
            `)
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .single();

        if (invoice) {
            // Fetch items with staff attribution
            const { data: items } = await supabase
                .from('invoice_items')
                .select(`
                    *,
                    performing_staff:staff!staff_id(id, name)
                `)
                .eq('invoice_id', params.id);

            // Get salon details
            const { data: salon } = await supabase
                .from('salons')
                .select('*')
                .eq('id', session.salonId)
                .single();

            return NextResponse.json({
                invoice: {
                    ...invoice,
                    items: items || [],
                    salon: {
                        name: salon?.name || 'SalonX',
                        address: salon?.address || '',
                        phone: salon?.phone || '',
                        email: salon?.email || '',
                        gst_number: salon?.gst_number || '',
                        logo: salon?.logo_url || '',
                    },
                },
            });
        }

        // Fallback: Try old bills table for backward compatibility
        const { data: bill, error: billError } = await supabase
            .from('bills')
            .select(`
                *,
                customer:customers(id, name, phone, email),
                items:bill_items(*)
            `)
            .eq('id', params.id)
            .eq('salon_id', session.salonId)
            .single();

        if (billError || !bill) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Get salon details
        const { data: salon } = await supabase
            .from('salons')
            .select('*')
            .eq('id', session.salonId)
            .single();

        return NextResponse.json({
            invoice: {
                ...bill,
                salon: {
                    name: salon?.name || 'SalonX',
                    address: salon?.address || '',
                    phone: salon?.phone || '',
                    email: salon?.email || '',
                    gst_number: salon?.gst_number || '',
                    logo: salon?.logo_url || '',
                },
            },
        });
    } catch (error) {
        console.error('Invoice GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
    }
}
