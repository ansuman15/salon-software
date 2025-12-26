"use client";

import { useState } from "react";
import { useSession } from "@/lib/SessionContext";
import Header from "@/components/layout/Header";
import styles from "./page.module.css";

export default function ProfilePage() {
    const { session, loading } = useSession();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        salonName: '',
        phone: '',
        city: '',
    });

    // Initialize form with session data when available
    const salonName = session?.salon?.name || 'Your Salon';
    const salonEmail = session?.salon?.email || '';

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            // TODO: Implement API call to update profile in Supabase
            await new Promise(resolve => setTimeout(resolve, 500));

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            setIsEditing(false);
        } catch {
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setIsSaving(false);
        }
    };

    const getInitials = (name: string) =>
        name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    return (
        <>
            <Header title="Profile" subtitle="Manage your account" />

            <div className={styles.container}>
                {message && (
                    <div className={`${styles.message} ${styles[message.type]}`}>
                        {message.text}
                    </div>
                )}

                <div className={styles.content}>
                    {/* Profile Card */}
                    <div className={styles.profileCard}>
                        <div className={styles.avatar}>
                            {getInitials(salonName)}
                        </div>
                        <h2>{salonName}</h2>
                        <p className={styles.role}>Owner</p>
                        <p className={styles.email}>{salonEmail}</p>

                        <div className={styles.badge}>
                            {session?.isAdmin ? (
                                <span className={styles.adminBadge}>Admin</span>
                            ) : (
                                <span className={styles.proBadge}>Active</span>
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
                                <h4>Salon Information</h4>
                                <div className={styles.formGrid}>
                                    <div className={styles.field}>
                                        <label>Salon Name</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.salonName || salonName}
                                                onChange={(e) => setFormData({ ...formData, salonName: e.target.value })}
                                            />
                                        ) : (
                                            <p>{salonName}</p>
                                        )}
                                    </div>
                                    <div className={styles.field}>
                                        <label>Email Address</label>
                                        <p className={styles.readonly}>{salonEmail}</p>
                                        <span className={styles.hint}>Email cannot be changed</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formSection}>
                                <h4>Contact Details</h4>
                                <div className={styles.formGrid}>
                                    <div className={styles.field}>
                                        <label>Phone Number</label>
                                        {isEditing ? (
                                            <input
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="+91 98765 43210"
                                            />
                                        ) : (
                                            <p>{formData.phone || 'Not set'}</p>
                                        )}
                                    </div>
                                    <div className={styles.field}>
                                        <label>City</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.city}
                                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                                placeholder="Enter city"
                                            />
                                        ) : (
                                            <p>{formData.city || 'Not set'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formSection}>
                                <h4>Account Status</h4>
                                <div className={styles.statusGrid}>
                                    <div className={styles.statusItem}>
                                        <span className={styles.statusLabel}>Account Status</span>
                                        <span className={styles.statusValue}>Active</span>
                                    </div>
                                    <div className={styles.statusItem}>
                                        <span className={styles.statusLabel}>Salon ID</span>
                                        <span className={styles.statusValue}>{session?.salon?.id || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
