"use client";

import Link from "next/link";
import styles from "./page.module.css";

const LogoIcon = () => (
    <div className={styles.logoIcon}>S</div>
);

export default function AuthPage() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>
                    <LogoIcon />
                    <span className={styles.logoText}>SalonX</span>
                </div>

                <div className={styles.header}>
                    <h1>Salon Admin Portal</h1>
                    <p>Manage your salon operations with ease</p>
                </div>

                <div className={styles.buttons}>
                    <Link href="/onboarding" className={styles.primaryBtn}>
                        <span className={styles.btnIcon}>+</span>
                        Create Account
                    </Link>
                    <Link href="/login" className={styles.secondaryBtn}>
                        <span className={styles.btnIcon}>→</span>
                        Login
                    </Link>
                </div>

                <p className={styles.terms}>
                    By continuing, you agree to our{" "}
                    <a href="#">Terms of Service</a> and{" "}
                    <a href="#">Privacy Policy</a>
                </p>
            </div>

            <Link href="/" className={styles.backLink}>
                ← Back to home
            </Link>
        </div>
    );
}
