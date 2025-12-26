"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider, useSession } from "@/lib/SessionContext";
import { ToastProvider } from "@/components/ui/Toast";
import Sidebar from "@/components/layout/Sidebar";
import styles from "./layout.module.css";

function DashboardContent({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { session, loading, error } = useSession();

    useEffect(() => {
        // Redirect to login if not authenticated
        if (!loading && (!session?.authenticated)) {
            const errorMsg = error || 'Please login to continue';
            router.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
        }
    }, [session, loading, error, router]);

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    if (!session?.authenticated) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p className={styles.authError}>Redirecting to login...</p>
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

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SessionProvider>
            <ToastProvider>
                <DashboardContent>{children}</DashboardContent>
            </ToastProvider>
        </SessionProvider>
    );
}

