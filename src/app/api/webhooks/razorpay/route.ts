/**
 * Razorpay Webhook Handler
 * POST /api/webhooks/razorpay
 * 
 * Handles async payment events from Razorpay
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, SUBSCRIPTION_PLANS } from '@/lib/razorpay';
import { getSupabaseAdmin } from '@/lib/supabase';

// Webhook event types we handle
type WebhookEvent =
    | 'payment.captured'
    | 'payment.failed'
    | 'refund.created'
    | 'subscription.activated'
    | 'subscription.cancelled';

interface WebhookPayload {
    event: WebhookEvent;
    payload: {
        payment?: {
            entity: {
                id: string;
                order_id: string;
                amount: number;
                status: string;
                notes?: Record<string, string>;
            };
        };
        refund?: {
            entity: {
                id: string;
                payment_id: string;
                amount: number;
                status: string;
            };
        };
    };
}

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text();

        // Get signature from headers
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            console.error('Missing webhook signature');
            return NextResponse.json(
                { error: 'Missing signature' },
                { status: 401 }
            );
        }

        // Check if webhook secret is configured
        if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
            console.warn('Webhook secret not configured, skipping verification');
            // In production, you should always verify
        } else {
            // Verify webhook signature
            const isValid = verifyWebhookSignature(rawBody, signature);

            if (!isValid) {
                console.error('Invalid webhook signature');
                return NextResponse.json(
                    { error: 'Invalid signature' },
                    { status: 401 }
                );
            }
        }

        // Parse payload
        const payload: WebhookPayload = JSON.parse(rawBody);
        const supabase = getSupabaseAdmin();

        console.log('Received webhook:', payload.event);

        switch (payload.event) {
            case 'payment.captured': {
                const payment = payload.payload.payment?.entity;
                if (!payment) break;

                // Update payment status
                await supabase
                    .from('payments')
                    .update({ status: 'completed' })
                    .eq('razorpay_order_id', payment.order_id);

                // Activate subscription if not already done
                const salonId = payment.notes?.salon_id;
                const planId = payment.notes?.plan_id || 'standard';

                if (salonId) {
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + 1);

                    await supabase
                        .from('subscriptions')
                        .upsert({
                            salon_id: salonId,
                            plan: planId,
                            status: 'active',
                            start_date: new Date().toISOString(),
                            end_date: endDate.toISOString(),
                            amount_paid: payment.amount / 100,
                        }, {
                            onConflict: 'salon_id',
                        });
                }
                break;
            }

            case 'payment.failed': {
                const payment = payload.payload.payment?.entity;
                if (!payment) break;

                await supabase
                    .from('payments')
                    .update({ status: 'failed' })
                    .eq('razorpay_order_id', payment.order_id);
                break;
            }

            case 'refund.created': {
                const refund = payload.payload.refund?.entity;
                if (!refund) break;

                // Get original payment
                const { data: originalPayment } = await supabase
                    .from('payments')
                    .select('salon_id')
                    .eq('razorpay_payment_id', refund.payment_id)
                    .single();

                if (originalPayment) {
                    // Create refund record
                    await supabase.from('payments').insert({
                        salon_id: originalPayment.salon_id,
                        amount: -(refund.amount / 100), // Negative for refund
                        status: 'refunded',
                        razorpay_payment_id: refund.id,
                        notes: JSON.stringify({ original_payment: refund.payment_id }),
                    });

                    // Update subscription status if full refund
                    await supabase
                        .from('subscriptions')
                        .update({ status: 'cancelled' })
                        .eq('salon_id', originalPayment.salon_id);
                }
                break;
            }

            case 'subscription.cancelled': {
                // Handle subscription cancellation
                // This would be used for recurring subscriptions
                break;
            }

            default:
                console.log('Unhandled webhook event:', payload.event);
        }

        // Always return 200 to acknowledge receipt
        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        // Return 200 anyway to prevent retries for parsing errors
        return NextResponse.json({ received: true, error: 'Processing failed' });
    }
}

// Only allow POST
export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
    );
}
