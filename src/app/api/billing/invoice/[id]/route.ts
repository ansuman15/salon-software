import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

function getSession(): SessionData | null {
    const cookieStore = cookies();
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
 * Get complete invoice data for PDF generation
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Get bill with items
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
                    logo: salon?.logo || '',
                },
            },
        });
    } catch (error) {
        console.error('Invoice GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
    }
}
