/**
 * Razorpay Checkout Component
 * Client-side payment interface
 */

"use client";

import { useState } from "react";
import styles from "./RazorpayCheckout.module.css";

// Razorpay types
declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
    }
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
}

interface RazorpayInstance {
    open: () => void;
    close: () => void;
}

interface RazorpayResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayCheckoutProps {
    planId: string;
    planName: string;
    amount: number;
    salonId: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    userPhone?: string;
    onSuccess?: (data: { plan: string; endDate: string }) => void;
    onError?: (error: string) => void;
    onClose?: () => void;
    className?: string;
    children?: React.ReactNode;
}

export default function RazorpayCheckout({
    planId,
    planName,
    amount,
    salonId,
    userId,
    userEmail,
    userName,
    userPhone,
    onSuccess,
    onError,
    onClose,
    className,
    children,
}: RazorpayCheckoutProps) {
    const [isLoading, setIsLoading] = useState(false);

    const loadRazorpayScript = (): Promise<boolean> => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }

            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayment = async () => {
        setIsLoading(true);

        try {
            // Load Razorpay script
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                throw new Error("Failed to load payment gateway. Please try again.");
            }

            // Create order
            const orderResponse = await fetch("/api/payments/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan_id: planId,
                    salon_id: salonId,
                    user_id: userId,
                    include_setup: true,
                }),
            });

            const orderData = await orderResponse.json();

            if (!orderResponse.ok) {
                throw new Error(orderData.error || "Failed to create order");
            }

            // Open Razorpay checkout
            const options: RazorpayOptions = {
                key: orderData.key_id,
                amount: orderData.order.amount,
                currency: orderData.order.currency,
                name: "SalonX",
                description: `${planName} Plan Subscription`,
                order_id: orderData.order.id,
                handler: async (response: RazorpayResponse) => {
                    // Verify payment on server
                    try {
                        const verifyResponse = await fetch("/api/payments/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                ...response,
                                salon_id: salonId,
                            }),
                        });

                        const verifyData = await verifyResponse.json();

                        if (!verifyResponse.ok) {
                            throw new Error(verifyData.error || "Payment verification failed");
                        }

                        onSuccess?.({
                            plan: verifyData.subscription.plan,
                            endDate: verifyData.subscription.end_date,
                        });
                    } catch (error) {
                        onError?.(error instanceof Error ? error.message : "Payment verification failed");
                    }
                },
                prefill: {
                    name: userName,
                    email: userEmail,
                    contact: userPhone,
                },
                notes: {
                    salon_id: salonId,
                    plan_id: planId,
                },
                theme: {
                    color: "#2d2826",
                },
                modal: {
                    ondismiss: () => {
                        setIsLoading(false);
                        onClose?.();
                    },
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.open();
        } catch (error) {
            onError?.(error instanceof Error ? error.message : "Payment failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            className={`${styles.checkoutBtn} ${className || ""}`}
            onClick={handlePayment}
            disabled={isLoading}
        >
            {isLoading ? (
                <span className={styles.loading}>
                    <span className={styles.spinner}></span>
                    Processing...
                </span>
            ) : (
                children || `Pay ₹${amount.toLocaleString("en-IN")}`
            )}
        </button>
    );
}
