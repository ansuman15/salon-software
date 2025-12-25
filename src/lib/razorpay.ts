/**
 * Razorpay Integration Library
 * Server-side utilities for payment processing
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

// Types
export interface CreateOrderParams {
    amount: number; // in paise (1 INR = 100 paise)
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
}

export interface OrderResponse {
    id: string;
    entity: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    currency: string;
    receipt: string;
    status: string;
    created_at: number;
}

export interface VerifyPaymentParams {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number; // in INR
    interval: 'monthly' | 'yearly';
    features: string[];
}

// Subscription plans
export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
    core: {
        id: 'core',
        name: 'Core',
        price: 1999,
        interval: 'monthly',
        features: [
            'Appointments & calendar',
            'Customer management',
            'Staff & services',
            'Billing & basic reports',
            'Secure cloud hosting',
            'Email support',
        ],
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        price: 4999,
        interval: 'monthly',
        features: [
            'Everything in Core',
            'Advanced reports',
            'Customer segmentation',
            'Staff performance insights',
            'WhatsApp confirmations',
            '300 WhatsApp/month',
            'Priority support',
        ],
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        price: 6999,
        interval: 'monthly',
        features: [
            'Everything in Standard',
            'Multi-branch ready',
            'Advanced permissions',
            'Audit logs',
            '1,000 WhatsApp/month',
            'Dedicated support',
        ],
    },
};

// Setup fees
export const SETUP_FEES: Record<string, number> = {
    core: 3999,
    standard: 4999,
    premium: 2999,
};

/**
 * Get Razorpay instance (server-side only)
 */
export function getRazorpayInstance(): Razorpay {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error('Missing Razorpay API keys');
    }

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
    });
}

/**
 * Create a new order for payment
 */
export async function createOrder(params: CreateOrderParams): Promise<OrderResponse> {
    const razorpay = getRazorpayInstance();

    const options = {
        amount: params.amount, // amount in paise
        currency: params.currency || 'INR',
        receipt: params.receipt || `order_${Date.now()}`,
        notes: params.notes || {},
    };

    try {
        const order = await razorpay.orders.create(options);
        return order as OrderResponse;
    } catch (error) {
        console.error('Razorpay order creation failed:', error);
        throw new Error('Failed to create payment order');
    }
}

/**
 * Verify payment signature
 * CRITICAL: Always verify on server-side, never trust client
 */
export function verifyPaymentSignature(params: VerifyPaymentParams): boolean {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
        throw new Error('Missing Razorpay key secret');
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

    // Create expected signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
    );
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
    body: string,
    signature: string
): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
        throw new Error('Missing Razorpay webhook secret');
    }

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
    );
}

/**
 * Get payment details
 */
export async function getPayment(paymentId: string) {
    const razorpay = getRazorpayInstance();

    try {
        const payment = await razorpay.payments.fetch(paymentId);
        return payment;
    } catch (error) {
        console.error('Failed to fetch payment:', error);
        throw new Error('Failed to fetch payment details');
    }
}

/**
 * Initiate refund
 */
export async function initiateRefund(
    paymentId: string,
    amount?: number,
    notes?: Record<string, string>
) {
    const razorpay = getRazorpayInstance();

    try {
        const refund = await razorpay.payments.refund(paymentId, {
            amount, // Optional: partial refund amount in paise
            notes: notes || {},
        });
        return refund;
    } catch (error) {
        console.error('Refund failed:', error);
        throw new Error('Failed to process refund');
    }
}

/**
 * Calculate total amount for subscription
 */
export function calculateSubscriptionAmount(
    planId: string,
    includeSetup: boolean = true
): { planAmount: number; setupFee: number; total: number } {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
        throw new Error(`Invalid plan: ${planId}`);
    }

    const setupFee = includeSetup ? (SETUP_FEES[planId] || 0) : 0;

    return {
        planAmount: plan.price,
        setupFee,
        total: plan.price + setupFee,
    };
}

/**
 * Generate idempotency key for orders
 */
export function generateIdempotencyKey(
    userId: string,
    planId: string
): string {
    const timestamp = Math.floor(Date.now() / 1000 / 60); // 1-minute resolution
    return crypto
        .createHash('sha256')
        .update(`${userId}:${planId}:${timestamp}`)
        .digest('hex')
        .substring(0, 32);
}
