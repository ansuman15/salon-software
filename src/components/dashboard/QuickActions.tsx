"use client";

import Link from "next/link";
import styles from "./QuickActions.module.css";

const PlusIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const WalkInIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
);

export default function QuickActions() {
    return (
        <div className={styles.container}>
            <Link href="/appointments" className={styles.actionCard}>
                <div className={styles.iconWrapper}>
                    <PlusIcon />
                </div>
                <div className={styles.actionText}>
                    <span className={styles.actionTitle}>New Booking</span>
                    <span className={styles.actionDesc}>Schedule appointment</span>
                </div>
            </Link>

            <Link href="/billing" className={styles.actionCard}>
                <div className={styles.iconWrapper}>
                    <WalkInIcon />
                </div>
                <div className={styles.actionText}>
                    <span className={styles.actionTitle}>Walk-in</span>
                    <span className={styles.actionDesc}>Quick checkout</span>
                </div>
            </Link>
        </div>
    );
}
