"use client";

import { useState } from "react";
import styles from "./UpgradeModal.module.css";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlan?: string;
    daysRemaining?: number;
}

const plans = [
    {
        id: "core",
        name: "Core",
        price: 1999,
        features: [
            "Appointments & calendar",
            "Customer management",
            "Staff & services",
            "Billing & basic reports",
            "Secure cloud hosting",
            "Email support",
        ],
    },
    {
        id: "standard",
        name: "Standard",
        price: 4999,
        popular: true,
        features: [
            "Everything in Core",
            "Advanced reports",
            "Customer segmentation",
            "Staff performance insights",
            "WhatsApp confirmations",
            "300 WhatsApp/month",
            "Priority support",
        ],
    },
    {
        id: "premium",
        name: "Premium",
        price: 6999,
        features: [
            "Everything in Standard",
            "Multi-branch ready",
            "Advanced permissions",
            "Audit logs",
            "Priority onboarding",
            "1,000 WhatsApp/month",
            "Dedicated support",
        ],
    },
];

export default function UpgradeModal({ isOpen, onClose, currentPlan, daysRemaining }: UpgradeModalProps) {
    const [selectedPlan, setSelectedPlan] = useState<string>("standard");
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setIsProcessing(true);

        // TODO: Integrate Razorpay here
        // For now, show a message
        await new Promise((resolve) => setTimeout(resolve, 1500));

        alert(
            `Razorpay integration required.\n\nSelected plan: ${selectedPlan.toUpperCase()}\nAmount: ₹${plans.find((p) => p.id === selectedPlan)?.price}/month\n\nPlease provide Razorpay API keys to enable payments.`
        );

        setIsProcessing(false);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>

                <div className={styles.header}>
                    <h2>Upgrade Your Plan</h2>
                    {daysRemaining !== undefined && daysRemaining > 0 ? (
                        <p>You have {daysRemaining} days left in your trial</p>
                    ) : (
                        <p>Your trial has ended. Choose a plan to continue.</p>
                    )}
                </div>

                <div className={styles.plans}>
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`${styles.planCard} ${selectedPlan === plan.id ? styles.selected : ""} ${plan.popular ? styles.popular : ""}`}
                            onClick={() => setSelectedPlan(plan.id)}
                        >
                            {plan.popular && <span className={styles.popularBadge}>Most Popular</span>}
                            <div className={styles.planHeader}>
                                <h3>{plan.name}</h3>
                                <div className={styles.price}>
                                    <span className={styles.currency}>₹</span>
                                    <span className={styles.amount}>{plan.price.toLocaleString("en-IN")}</span>
                                    <span className={styles.period}>/mo</span>
                                </div>
                            </div>
                            <ul className={styles.features}>
                                {plan.features.map((feature, i) => (
                                    <li key={i}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            <div className={styles.radio}>
                                <div className={`${styles.radioInner} ${selectedPlan === plan.id ? styles.checked : ""}`} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.footer}>
                    <button className={styles.upgradeBtn} onClick={handleUpgrade} disabled={isProcessing}>
                        {isProcessing ? (
                            "Processing..."
                        ) : (
                            <>
                                Upgrade to {plans.find((p) => p.id === selectedPlan)?.name} - ₹
                                {plans.find((p) => p.id === selectedPlan)?.price.toLocaleString("en-IN")}/mo
                            </>
                        )}
                    </button>
                    <p className={styles.secure}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Secure payment via Razorpay
                    </p>
                </div>
            </div>
        </div>
    );
}
