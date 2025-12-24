"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/database";

export default function Home() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if onboarding is complete
        const isOnboarded = db.auth.isOnboardingComplete();

        if (isOnboarded) {
            router.push("/dashboard");
        } else {
            router.push("/onboarding");
        }

        setIsLoading(false);
    }, [router]);

    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FAF8F5'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #E8E4DF',
                    borderTopColor: '#2D2A26',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
            </div>
        );
    }

    return null;
}
