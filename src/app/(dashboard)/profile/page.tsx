"use client";

import { useState, useEffect } from "react";
import { db, User, Salon } from "@/lib/database";
import styles from "./page.module.css";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [salon, setSalon] = useState<Salon | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        salonName: '',
        phone: '',
        city: '',
    });

    useEffect(() => {
        const userData = db.auth.getCurrentUser();
        const salonData = db.salon.get();
        setUser(userData);
        setSalon(salonData);

        if (userData && salonData) {
            setFormData({
                name: userData.name,
                email: userData.email,
                salonName: salonData.name,
                phone: salonData.phone,
                city: salonData.city,
            });
        }
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            // Update salon
            if (salon) {
                db.salon.update({
                    ...salon,
                    name: formData.salonName,
                    phone: formData.phone,
                    city: formData.city,
                });
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setIsEditing(false);

            // Refresh data
            setSalon(db.salon.get());
        } catch {
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const getInitials = (name: string) =>
        name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

    const session = db.auth.getSession();
    const subscription = db.subscription.get();

    if (!user || !salon) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Profile</h1>
                <p>Manage your account and salon information</p>
            </div>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.text}
                </div>
            )}

            <div className={styles.content}>
                {/* Profile Card */}
                <div className={styles.profileCard}>
                    <div className={styles.avatar}>
                        {getInitials(user.name)}
                    </div>
                    <h2>{user.name}</h2>
                    <p className={styles.role}>{user.role}</p>
                    <p className={styles.email}>{user.email}</p>

                    <div className={styles.badge}>
                        {session?.isAdmin ? (
                            <span className={styles.adminBadge}>Admin</span>
                        ) : subscription?.plan === 'trial' ? (
                            <span className={styles.trialBadge}>Trial</span>
                        ) : (
                            <span className={styles.proBadge}>{subscription?.plan || 'Free'}</span>
                        )}
                    </div>
                </div>

                {/* Details Form */}
                <div className={styles.detailsCard}>
                    <div className={styles.cardHeader}>
                        <h3>Account Details</h3>
                        {!isEditing ? (
                            <button className={styles.editBtn} onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        ) : (
                            <div className={styles.editActions}>
                                <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>
                                    Cancel
                                </button>
                                <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className={styles.form}>
                        <div className={styles.formSection}>
                            <h4>Personal Information</h4>
                            <div className={styles.formGrid}>
                                <div className={styles.field}>
                                    <label>Full Name</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    ) : (
                                        <p>{formData.name}</p>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <label>Email Address</label>
                                    <p className={styles.readonly}>{formData.email}</p>
                                    <span className={styles.hint}>Email cannot be changed</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.formSection}>
                            <h4>Salon Information</h4>
                            <div className={styles.formGrid}>
                                <div className={styles.field}>
                                    <label>Salon Name</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={formData.salonName}
                                            onChange={(e) => setFormData({ ...formData, salonName: e.target.value })}
                                        />
                                    ) : (
                                        <p>{formData.salonName}</p>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <label>Phone Number</label>
                                    {isEditing ? (
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    ) : (
                                        <p>{formData.phone}</p>
                                    )}
                                </div>
                                <div className={styles.field}>
                                    <label>City</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={formData.city}
                                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        />
                                    ) : (
                                        <p>{formData.city}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.formSection}>
                            <h4>Account Status</h4>
                            <div className={styles.statusGrid}>
                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>Member Since</span>
                                    <span className={styles.statusValue}>
                                        {new Date(user.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className={styles.statusItem}>
                                    <span className={styles.statusLabel}>Subscription</span>
                                    <span className={styles.statusValue}>
                                        {subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : 'None'}
                                    </span>
                                </div>
                                {subscription?.endDate && (
                                    <div className={styles.statusItem}>
                                        <span className={styles.statusLabel}>Valid Until</span>
                                        <span className={styles.statusValue}>
                                            {new Date(subscription.endDate).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
