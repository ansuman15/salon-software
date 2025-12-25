/**
 * Verify Payment API Route
 * POST /api/payments/verify
 * 
 * Verifies Razorpay payment signature and activates subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentSignature, getPayment, SUBSCRIPTION_PLANS } from '@/lib/razorpay';
import { getSupabaseAdmin } from '@/lib/supabase';

interface VerifyPaymentBody {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    salon_id: string;
}

export async function POST(request: NextRequest) {
    try {
        // Parse body
        const body: VerifyPaymentBody = await request.json();

        // Validate required fields
        if (!body.razorpay_order_id || !body.razorpay_payment_id || !body.razorpay_signature) {
            return NextResponse.json(
                { error: 'Missing payment verification fields' },
                { status: 400 }
            );
        }

        if (!body.salon_id) {
            return NextResponse.json(
                { error: 'Missing salon_id' },
                { status: 400 }
            );
        }

        // Check if Razorpay is configured
        if (!process.env.RAZORPAY_KEY_SECRET) {
            return NextResponse.json(
                { error: 'Payment gateway not configured' },
                { status: 503 }
            );
        }

        // ⚠️ CRITICAL: Verify signature server-side
        const isValid = verifyPaymentSignature({
            razorpay_order_id: body.razorpay_order_id,
            razorpay_payment_id: body.razorpay_payment_id,
            razorpay_signature: body.razorpay_signature,
        });

        if (!isValid) {
            console.error('Invalid payment signature:', body.razorpay_order_id);
            return NextResponse.json(
                { error: 'Payment verification failed. Invalid signature.' },
                { status: 400 }
            );
        }

        // Fetch payment details from Razorpay
        const payment = await getPayment(body.razorpay_payment_id);

        if (payment.status !== 'captured') {
            return NextResponse.json(
                { error: `Payment not captured. Status: ${payment.status}` },
                { status: 400 }
            );
        }

        // Get order details to find plan
        const supabase = getSupabaseAdmin();

        // Update payment record
        const { error: paymentError } = await supabase
            .from('payments')
            .update({
                status: 'completed',
                razorpay_payment_id: body.razorpay_payment_id,
                razorpay_signature: body.razorpay_signature,
            })
            .eq('razorpay_order_id', body.razorpay_order_id);

        if (paymentError) {
            console.error('Failed to update payment:', paymentError);
        }

        // Get plan from payment notes
        const { data: paymentRecord } = await supabase
            .from('payments')
            .select('notes')
            .eq('razorpay_order_id', body.razorpay_order_id)
            .single();

        let planId = 'standard'; // default
        if (paymentRecord?.notes) {
            try {
                const notes = JSON.parse(paymentRecord.notes);
                planId = notes.plan_id || 'standard';
            } catch {
                console.error('Failed to parse payment notes');
            }
        }

        // Calculate subscription end date (1 month from now)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        // Create or update subscription
        const { error: subError } = await supabase
            .from('subscriptions')
            .upsert({
                salon_id: body.salon_id,
                plan: planId,
                status: 'active',
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
                amount_paid: Number(payment.amount) / 100, // Convert paise to INR
            }, {
                onConflict: 'salon_id',
            });

        if (subError) {
            console.error('Failed to create subscription:', subError);
            return NextResponse.json(
                { error: 'Payment successful but failed to activate subscription. Please contact support.' },
                { status: 500 }
            );
        }

        // Return success
        return NextResponse.json({
            success: true,
            message: 'Payment verified and subscription activated',
            subscription: {
                plan: planId,
                plan_name: SUBSCRIPTION_PLANS[planId]?.name || planId,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString(),
            },
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        return NextResponse.json(
            { error: 'Payment verification failed. Please contact support.' },
            { status: 500 }
        );
    }
}
