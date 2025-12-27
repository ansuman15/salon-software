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
 * GET /api/coupons
 * List all coupons for the salon
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') !== 'false';

        const supabase = getSupabaseAdmin();
        let query = supabase
            .from('coupons')
            .select('*')
            .eq('salon_id', session.salonId)
            .order('created_at', { ascending: false });

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Coupons GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
    }
}

/**
 * POST /api/coupons
 * Create a new coupon
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const {
            code,
            description,
            discount_type,
            discount_value,
            min_order_value,
            max_discount,
            max_uses,
            valid_from,
            valid_until,
        } = body;

        if (!code || !discount_type || !discount_value) {
            return NextResponse.json(
                { error: 'Code, discount type, and discount value are required' },
                { status: 400 }
            );
        }

        if (!['percentage', 'fixed'].includes(discount_type)) {
            return NextResponse.json(
                { error: 'Discount type must be percentage or fixed' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('coupons')
            .insert({
                salon_id: session.salonId,
                code: code.toUpperCase(),
                description: description || null,
                discount_type,
                discount_value,
                min_order_value: min_order_value || 0,
                max_discount: max_discount || null,
                max_uses: max_uses || null,
                valid_from: valid_from || new Date().toISOString().split('T')[0],
                valid_until: valid_until || null,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json({ error: 'Coupon code already exists' }, { status: 400 });
            }
            throw error;
        }

        return NextResponse.json({
            success: true,
            data,
            message: 'Coupon created successfully',
        });
    } catch (error) {
        console.error('Coupons POST error:', error);
        return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 });
    }
}
