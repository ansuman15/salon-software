"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/database";
import styles from "./page.module.css";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Check if already authenticated - redirect to dashboard
    useEffect(() => {
        const checkAuth = () => {
            console.log('[Login] Checking existing authentication...');

            if (db.auth.isAuthenticated()) {
                console.log('[Login] Already authenticated, redirecting to dashboard...');
                router.replace("/dashboard");
                return;
            }

            setPageLoading(false);
        };

        checkAuth();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validate inputs on client side first
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();

        if (!trimmedEmail || !trimmedPassword) {
            setError("Please fill in all fields");
            return;
        }

        // Basic email validation
        if (!trimmedEmail.includes("@")) {
            setError("Please enter a valid email address");
            return;
        }

        setIsLoading(true);

        // Small delay for UX
        await new Promise(resolve => setTimeout(resolve, 500));

        // Attempt login
        console.log('[Login] Attempting login for:', trimmedEmail);
        const result = db.auth.login(trimmedEmail, trimmedPassword);

        if (result.success) {
            console.log('[Login] Login successful, redirecting to dashboard...');
            router.push("/dashboard");
        } else {
            console.log('[Login] Login failed:', result.message);
            setError(result.message || "Invalid email or password");
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
                    <h1>Welcome back</h1>
                    <p>Sign in to your salon dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {error && (
                        <div className={styles.error}>
                            {error}
                        </div>
                    )}

                    <div className={styles.field}>
                        <label htmlFor="email">Email</label>
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
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isLoading}
                    >
                        {isLoading ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>or</span>
                </div>

                <p className={styles.signup}>
                    Don't have an account?{" "}
                    <Link href="/onboarding">Create one</Link>
                </p>

                <div className={styles.adminHint}>
                    <p>Developer access: admin@salonx.in</p>
                </div>
            </div>

            <Link href="/" className={styles.backLink}>
                ← Back to home
            </Link>
        </div>
    );
}
