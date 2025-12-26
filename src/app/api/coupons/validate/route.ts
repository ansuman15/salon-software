import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

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
 * POST /api/coupons/validate
 * Validate and apply a coupon code
 */
export async function POST(request: NextRequest) {
    try {
        const session = getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { code, order_value } = body;

        if (!code) {
            return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Call validation function
        const { data, error } = await supabase.rpc('validate_coupon', {
            p_salon_id: session.salonId,
            p_code: code,
            p_order_value: order_value || 0,
        });

        if (error) throw error;

        const result = data[0];

        if (!result.valid) {
            return NextResponse.json({
                valid: false,
                message: result.message,
            });
        }

        // Calculate discount amount
        let discountAmount = 0;
        if (result.discount_type === 'percentage') {
            discountAmount = (order_value * result.discount_value) / 100;
            if (result.max_discount && discountAmount > result.max_discount) {
                discountAmount = result.max_discount;
            }
        } else {
            discountAmount = result.discount_value;
        }

        return NextResponse.json({
            valid: true,
            message: result.message,
            coupon_id: result.coupon_id,
            discount_type: result.discount_type,
            discount_value: result.discount_value,
            discount_amount: discountAmount,
        });
    } catch (error) {
        console.error('Coupon validate error:', error);
        return NextResponse.json({ error: 'Failed to validate coupon' }, { status: 500 });
    }
}
