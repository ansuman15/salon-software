"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "@/lib/SessionContext";
import styles from "./Header.module.css";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

interface Notification {
    id: string;
    type: string;
    title: string;
    message?: string;
    read: boolean;
    created_at: string;
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

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default function Header({ title, subtitle }: HeaderProps) {
    const { session } = useSession();
    const [searchQuery, setSearchQuery] = useState("");
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const salonName = session?.salon?.name || 'User';
    const logoUrl = session?.salon?.logo_url;

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            setLoadingNotifications(true);
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoadingNotifications(false);
        }
    };

    // Fetch on mount and when dropdown opens
    useEffect(() => {
        if (showNotifications) {
            fetchNotifications();
        }
    }, [showNotifications]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = () => {
        setShowNotifications(!showNotifications);
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true })
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'appointment_created': return '📅';
            case 'payment_received': return '💰';
            case 'low_stock': return '📦';
            case 'staff_activity': return '👤';
            default: return '🔔';
        }
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

                <div className={styles.notificationWrapper} ref={dropdownRef}>
                    <button
                        className={styles.notificationBtn}
                        onClick={handleNotificationClick}
                        title="Notifications"
                    >
                        <BellIcon />
                        {unreadCount > 0 && (
                            <span className={styles.notificationBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className={styles.notificationDropdown}>
                            <div className={styles.notificationHeader}>
                                <span>Notifications</span>
                                {unreadCount > 0 && (
                                    <button onClick={markAllAsRead} className={styles.markReadBtn}>
                                        <CheckIcon /> Mark all read
                                    </button>
                                )}
                            </div>

                            {loadingNotifications ? (
                                <div className={styles.notificationLoading}>Loading...</div>
                            ) : notifications.length === 0 ? (
                                <div className={styles.notificationEmpty}>
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                <div className={styles.notificationList}>
                                    {notifications.slice(0, 10).map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''}`}
                                        >
                                            <span className={styles.notificationIcon}>
                                                {getNotificationIcon(notification.type)}
                                            </span>
                                            <div className={styles.notificationContent}>
                                                <span className={styles.notificationTitle}>{notification.title}</span>
                                                {notification.message && (
                                                    <span className={styles.notificationMessage}>{notification.message}</span>
                                                )}
                                                <span className={styles.notificationTime}>
                                                    {formatTime(notification.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* User Profile - Shows logo or initials */}
                <Link href="/settings" className={styles.userSection}>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{salonName}</span>
                        <span className={styles.userRole}>Owner</span>
                    </div>
                    <div className={styles.avatar}>
                        {logoUrl ? (
                            <img src={logoUrl} alt={salonName} className={styles.avatarImage} />
                        ) : (
                            getInitials(salonName)
                        )}
                    </div>
                </Link>
            </div>
        </header>
    );
}

