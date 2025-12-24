"use client";

import { useState } from "react";
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        // Validate inputs
        if (!email || !password) {
            setError("Please fill in all fields");
            setIsLoading(false);
            return;
        }

        // Attempt login
        const result = db.auth.login(email, password);

        if (result.success) {
            router.push("/dashboard");
        } else {
            setError(result.message || "Invalid email or password");
            setIsLoading(false);
        }
    };

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
            </div>

            <Link href="/" className={styles.backLink}>
                ← Back to home
            </Link>
        </div>
    );
}
