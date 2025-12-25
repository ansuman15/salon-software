"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const checkAccess = async () => {
            console.log('[Dashboard] Checking access...');

            // Check session via API first (for cookie-based auth)
            try {
                const res = await fetch('/api/auth/session');
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) {
                        console.log('[Dashboard] Session valid via API');
                        setIsChecking(false);
                        return;
                    } else if (data.reason) {
                        console.log('[Dashboard] Session invalid:', data.reason);
                        setAuthError(data.reason);
                        // Redirect with error message
                        const errorParam = encodeURIComponent(data.reason);
                        router.replace(`/login?error=${errorParam}`);
                        return;
                    }
                }
            } catch (e) {
                console.log('[Dashboard] API session check failed, trying local');
            }

            // Fallback to local session check (for dev mode)
            const sessionValidation = db.auth.validateSession();
            if (!sessionValidation.valid) {
                console.log('[Dashboard] Session invalid:', sessionValidation.reason);
                setAuthError(sessionValidation.reason || 'Session invalid');
                router.replace("/login");
                return;
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
                {children}
            </main>
        </div>
    );
}
