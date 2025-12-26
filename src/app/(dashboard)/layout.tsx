"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import styles from "./layout.module.css";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const checkAccess = async () => {
            console.log('[Dashboard] Checking access...');

            // Check session via API (cookie-based auth)
            try {
                const res = await fetch('/api/auth/session');
                const data = await res.json();

                if (res.ok && data.authenticated) {
                    console.log('[Dashboard] Session valid');
                    setIsChecking(false);
                    return;
                }

                // Not authenticated - redirect to login
                console.log('[Dashboard] Not authenticated:', data.reason || 'No session');
                const errorMsg = data.reason || 'Please login to continue';
                setAuthError(errorMsg);
                router.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
                return;
            } catch (e) {
                console.error('[Dashboard] Session check failed:', e);
                router.replace('/login?error=Session%20check%20failed');
                return;
            }
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
                {children}
            </main>
        </div>
    );
}
