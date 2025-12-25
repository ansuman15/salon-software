/**
 * Create Order API Route
 * POST /api/payments/create-order
 * 
 * Creates a Razorpay order for subscription payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOrder, calculateSubscriptionAmount, SUBSCRIPTION_PLANS, generateIdempotencyKey } from '@/lib/razorpay';
import { getSupabaseAdmin } from '@/lib/supabase';

// Input validation
interface CreateOrderBody {
    plan_id: string;
    salon_id: string;
    user_id: string;
    include_setup?: boolean;
}

// Rate limiting (simple in-memory for demo)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 5; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);

    if (!userLimit || now - userLimit.timestamp > RATE_WINDOW) {
        rateLimitMap.set(userId, { count: 1, timestamp: now });
        return true;
    }

    if (userLimit.count >= RATE_LIMIT) {
        return false;
    }

    userLimit.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        // Parse and validate body
        const body: CreateOrderBody = await request.json();

        if (!body.plan_id || !body.salon_id || !body.user_id) {
            return NextResponse.json(
                { error: 'Missing required fields: plan_id, salon_id, user_id' },
                { status: 400 }
            );
        }

        // Validate plan
        if (!SUBSCRIPTION_PLANS[body.plan_id]) {
            return NextResponse.json(
                { error: 'Invalid plan_id' },
                { status: 400 }
            );
        }

        // Rate limiting
        if (!checkRateLimit(body.user_id)) {
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
        }

        // Check if Razorpay is configured
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return NextResponse.json(
                { error: 'Payment gateway not configured. Please contact support.' },
                { status: 503 }
            );
        }

        // Calculate amount
        const { planAmount, setupFee, total } = calculateSubscriptionAmount(
            body.plan_id,
            body.include_setup !== false
        );

        // Generate idempotency key to prevent duplicate orders
        const idempotencyKey = generateIdempotencyKey(body.user_id, body.plan_id);

        // Create Razorpay order
        const order = await createOrder({
            amount: total * 100, // Convert to paise
            currency: 'INR',
            receipt: `sub_${body.salon_id}_${Date.now()}`,
            notes: {
                salon_id: body.salon_id,
                user_id: body.user_id,
                plan_id: body.plan_id,
                plan_amount: planAmount.toString(),
                setup_fee: setupFee.toString(),
                idempotency_key: idempotencyKey,
            },
        });

        // Store pending order in database
        const supabase = getSupabaseAdmin();
        await supabase.from('payments').insert({
            salon_id: body.salon_id,
            amount: total,
            status: 'pending',
            razorpay_order_id: order.id,
            notes: JSON.stringify({
                plan_id: body.plan_id,
                plan_amount: planAmount,
                setup_fee: setupFee,
            }),
        });

        // Return order details to client
        return NextResponse.json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
            breakdown: {
                plan_amount: planAmount,
                setup_fee: setupFee,
                total,
            },
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Create order error:', error);
        return NextResponse.json(
            { error: 'Failed to create order. Please try again.' },
            { status: 500 }
        );
    }
}
