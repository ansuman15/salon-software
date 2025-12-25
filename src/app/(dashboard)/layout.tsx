"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import UpgradeModal from "@/components/dashboard/UpgradeModal";
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
    const [authError, setAuthError] = useState<string | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    useEffect(() => {
        const checkAccess = () => {
            console.log('[Dashboard] Checking access...');

            // First validate session strictly
            const sessionValidation = db.auth.validateSession();
            if (!sessionValidation.valid) {
                console.log('[Dashboard] Session invalid:', sessionValidation.reason);
                setAuthError(sessionValidation.reason || 'Session invalid');
                // Redirect to login
                router.replace("/login");
                return;
            }

            // Check if onboarding is complete
            if (!db.auth.isOnboardingComplete()) {
                console.log('[Dashboard] Onboarding not complete, redirecting...');
                router.replace("/onboarding");
                return;
            }

            // Check dashboard access (subscription/trial status)
            const access = db.auth.canAccessDashboard();
            console.log('[Dashboard] Access check:', access);

            if (!access.allowed) {
                console.log('[Dashboard] Access denied:', access.reason);
                // Redirect to appropriate page
                if (access.reason === 'No subscription found' || access.reason === 'Subscription expired') {
                    router.replace("/subscribe");
                } else {
                    router.replace("/login");
                }
                return;
            }

            if (access.daysRemaining !== undefined) {
                setTrialDays(access.daysRemaining);
            }

            console.log('[Dashboard] Access granted');
            setIsChecking(false);
        };

        checkAccess();
    }, [router]);

    if (isChecking) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                {authError && <p className={styles.authError}>{authError}</p>}
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                {/* Trial Banner - Clickable to show upgrade modal */}
                {trialDays !== null && trialDays <= 14 && (
                    <div className={styles.trialBanner}>
                        <span>
                            🎉 {trialDays > 0
                                ? `You have ${trialDays} day${trialDays === 1 ? '' : 's'} left in your free trial`
                                : 'Your trial has ended'}
                        </span>
                        <button className={styles.upgradeBtn} onClick={() => setShowUpgradeModal(true)}>
                            Upgrade Now
                        </button>
                    </div>
                )}
                {children}
            </main>

            {/* Upgrade Modal */}
            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                daysRemaining={trialDays || 0}
            />
        </div>
    );
}
