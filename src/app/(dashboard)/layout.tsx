"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { db } from "@/lib/database";
import styles from "./layout.module.css";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [trialDays, setTrialDays] = useState<number | null>(null);

    useEffect(() => {
        // Check if authenticated
        if (!db.auth.isAuthenticated()) {
            if (!db.auth.isOnboardingComplete()) {
                router.push("/auth");
            } else {
                router.push("/login");
            }
            return;
        }

        // Check dashboard access (trial/subscription status)
        const access = db.auth.canAccessDashboard();

        if (!access.allowed) {
            // Redirect to subscription page if no access
            router.push("/subscribe");
            return;
        }

        if (access.daysRemaining !== undefined) {
            setTrialDays(access.daysRemaining);
        }

        setIsChecking(false);
    }, [router]);

    if (isChecking) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                {/* Trial Banner */}
                {trialDays !== null && trialDays <= 14 && (
                    <div className={styles.trialBanner}>
                        <span>
                            🎉 {trialDays > 0
                                ? `You have ${trialDays} day${trialDays === 1 ? '' : 's'} left in your free trial`
                                : 'Your trial has ended'}
                        </span>
                        <Link href="/subscribe" className={styles.upgradeBtn}>
                            Upgrade Now
                        </Link>
                    </div>
                )}
                {children}
            </main>
        </div>
    );
}
