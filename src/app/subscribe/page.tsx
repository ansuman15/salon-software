"use client";

import Link from "next/link";
import styles from "./page.module.css";

const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const plans = [
    {
        name: "Core",
        price: "1,999",
        setup: "3,999",
        features: [
            "Appointments & calendar",
            "Customer management",
            "Staff & services",
            "Billing & basic reports",
            "Secure cloud hosting",
            "Email support"
        ]
    },
    {
        name: "Standard",
        price: "4,999",
        setup: "4,999",
        popular: true,
        features: [
            "Everything in Core",
            "Advanced reports",
            "Customer segmentation",
            "Staff performance insights",
            "WhatsApp confirmations",
            "300 WhatsApp/month",
            "Priority support"
        ]
    },
    {
        name: "Premium",
        price: "6,999",
        setup: "2,999",
        features: [
            "Everything in Standard",
            "Multi-branch ready",
            "Advanced permissions",
            "Audit logs",
            "1,000 WhatsApp/month",
            "Dedicated support"
        ]
    }
];

export default function SubscribePage() {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>S</span>
                    <span className={styles.logoText}>SalonX</span>
                </Link>
            </div>

            <div className={styles.content}>
                <div className={styles.title}>
                    <h1>Choose Your Plan</h1>
                    <p>Your trial has ended. Subscribe to continue using SalonX.</p>
                </div>

                <div className={styles.pricingGrid}>
                    {plans.map((plan, i) => (
                        <div
                            key={i}
                            className={`${styles.pricingCard} ${plan.popular ? styles.popular : ""}`}
                        >
                            {plan.popular && <div className={styles.popularBadge}>Recommended</div>}
                            <h3>{plan.name}</h3>
                            <div className={styles.price}>
                                <span className={styles.currency}>₹</span>
                                <span className={styles.amount}>{plan.price}</span>
                                <span className={styles.period}>/month</span>
                            </div>
                            <p className={styles.setup}>Setup: ₹{plan.setup}</p>
                            <ul className={styles.features}>
                                {plan.features.map((feature, j) => (
                                    <li key={j}>
                                        <CheckIcon />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <button className={styles.subscribeBtn}>
                                Subscribe Now
                            </button>
                        </div>
                    ))}
                </div>

                <div className={styles.notice}>
                    <p>
                        <strong>Payment integration coming soon!</strong><br />
                        Contact us at <a href="mailto:support@salonx.in">support@salonx.in</a> to subscribe manually.
                    </p>
                </div>

                <div className={styles.backLink}>
                    <Link href="/">← Back to home</Link>
                </div>
            </div>
        </div>
    );
}
