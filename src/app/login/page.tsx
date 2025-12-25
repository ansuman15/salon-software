"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

// Wrap the main component to support useSearchParams with Suspense
export default function LoginPage() {
    return (
        <Suspense fallback={<div className={styles.container}><div className={styles.loadingDots}><div className={styles.dot}></div><div className={styles.dot}></div><div className={styles.dot}></div></div></div>}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [activationKey, setActivationKey] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Check if already authenticated - redirect to dashboard
    useEffect(() => {
        // Check for error in URL params (e.g., from session invalidation)
        const urlError = searchParams.get('error');
        if (urlError) {
            setError(decodeURIComponent(urlError));
        }

        const checkAuth = async () => {
            // Check for existing session cookie via API
            try {
                const res = await fetch('/api/auth/session');
                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated) {
                        router.replace("/dashboard");
                        return;
                    }
                }
            } catch (e) {
                // No session, continue to login
            }
            setPageLoading(false);
        };

        checkAuth();
    }, [router, searchParams]);

    const formatActivationKey = (value: string) => {
        // Auto-format as user types: SALONX-XXXX-XXXX-XXXX
        const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        return cleaned;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const trimmedEmail = email.trim();
        const trimmedKey = activationKey.trim();

        if (!trimmedEmail || !trimmedKey) {
            setError("Please fill in all fields");
            return;
        }

        if (!trimmedEmail.includes("@")) {
            setError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: trimmedEmail,
                    activationKey: trimmedKey
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                router.push("/dashboard");
            } else {
                setError(data.error || "Invalid credentials");
            }
        } catch (err) {
            setError("Unable to connect. Please check your internet and try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>
                    <div className={styles.logoIcon}>S</div>
                    <span className={styles.logoText}>SalonX</span>
                </div>

                <div className={styles.header}>
                    <h1>Welcome to SalonX</h1>
                    <p>Sign in with your activation key</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && (
                        <div className={styles.error}>
                            {error}
                        </div>
                    )}

                    <div className={styles.field}>
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="email"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className={styles.field}>
                        <label htmlFor="activationKey">Activation Key</label>
                        <input
                            type="text"
                            id="activationKey"
                            value={activationKey}
                            onChange={(e) => setActivationKey(formatActivationKey(e.target.value))}
                            placeholder="SALONX-XXXX-XXXX-XXXX"
                            autoComplete="off"
                            required
                            disabled={isLoading}
                            style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                        />
                        <small className={styles.fieldHint}>
                            Your activation key was provided by SalonX support
                        </small>
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing in..." : "Login to SalonX"}
                    </button>
                </form>

                <div className={styles.helpText}>
                    <p>
                        Don't have an activation key?{" "}
                        <a href="mailto:support@salonx.in">Contact Support</a>
                    </p>
                </div>
            </div>

            <Link href="/" className={styles.backLink}>
                ← Back to home
            </Link>
        </div>
    );
}
