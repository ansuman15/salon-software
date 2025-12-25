"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db, User } from "@/lib/database";
import styles from "./Header.module.css";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const BellIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

export default function Header({ title, subtitle }: HeaderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const currentUser = db.auth.getCurrentUser();
        setUser(currentUser);
    }, []);

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
    };

    return (
        <header className={styles.header}>
            <div className={styles.titleSection}>
                <h1 className={styles.title}>{title}</h1>
                {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>

            <div className={styles.actions}>
                <div className={styles.searchWrapper}>
                    <SearchIcon />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.notificationWrapper}>
                    <button
                        className={styles.notificationBtn}
                        onClick={handleNotificationClick}
                        title="Notifications"
                    >
                        <BellIcon />
                        <span className={styles.notificationBadge}></span>
                    </button>

                    {showNotifications && (
                        <div className={styles.notificationDropdown}>
                            <div className={styles.notificationHeader}>
                                <span>Notifications</span>
                            </div>
                            <div className={styles.notificationEmpty}>
                                <p>No new notifications</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile - Clickable */}
                <Link href="/profile" className={styles.userSection}>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{user?.name || 'User'}</span>
                        <span className={styles.userRole}>{user?.role || 'Owner'}</span>
                    </div>
                    <div className={styles.avatar}>
                        {user?.name ? getInitials(user.name) : 'U'}
                    </div>
                </Link>
            </div>
        </header>
    );
}
