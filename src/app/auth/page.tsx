"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Auth page - Redirects to login
 * No self-signup available
 */
export default function AuthPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/login");
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #faf9f7 0%, #f5f0e8 50%, #f8f0f0 100%)',
        }}>
            <div style={{
                width: 32,
                height: 32,
                border: '3px solid #e5e3e0',
                borderTopColor: '#2d2826',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            <style jsx>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
