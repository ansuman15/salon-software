"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/SessionContext";
import Header from "@/components/layout/Header";
import { ImageCropper } from "@/components/ImageCropper";
import { useToast } from "@/components/ui/Toast";
import styles from "./page.module.css";

export default function ProfilePage() {
    const { session, loading, refresh } = useSession();
    const toast = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showLogoCropper, setShowLogoCropper] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        salonName: '',
        phone: '',
        city: '',
        address: '',
        gstEnabled: false,
    });

    // Initialize form with session data when available
    const salonName = session?.salon?.name || 'Your Salon';
    const salonEmail = session?.salon?.email || '';

    // Load initial data from session
    useEffect(() => {
        if (session?.salon) {
            setFormData({
                name: '',
                salonName: session.salon.name || '',
                phone: session.salon.phone || '',
                city: session.salon.city || '',
                address: (session.salon as { address?: string }).address || '',
                gstEnabled: (session.salon as { gst_enabled?: boolean }).gst_enabled ?? false,
            });
            if (session.salon.logo_url) {
                setLogoUrl(session.salon.logo_url);
            }
        }
    }, [session]);

    const handleSave = async () => {
        console.log('[Profile] Starting save...', { formData });
        setIsSaving(true);
        setMessage(null);

        try {
            const payload = {
                name: formData.salonName,
                phone: formData.phone,
                city: formData.city,
                address: formData.address,
                gst_enabled: formData.gstEnabled,
            };

            console.log('[Profile] Sending PATCH to /api/salon with:', payload);

            const res = await fetch('/api/salon', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            console.log('[Profile] Response status:', res.status);

            const data = await res.json();
            console.log('[Profile] Response data:', data);

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }

            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            toast.success('Profile saved successfully!');
            setIsEditing(false);
            console.log('[Profile] Save successful, refreshing session...');

            // Refresh session to get updated data
            if (refresh) {
                await refresh();
                console.log('[Profile] Session refreshed');
            }
        } catch (error) {
            console.error('[Profile] Save error:', error);
            const errorMsg = error instanceof Error ? error.message : 'Failed to update profile. Please try again.';
            setMessage({ type: 'error', text: errorMsg });
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
            console.log('[Profile] Save process completed');
        }
    };

    const handleLogoUpload = async (croppedBlob: Blob) => {
        setIsUploadingLogo(true);
        setShowLogoCropper(false);

        try {
            const formData = new FormData();
            formData.append('logo', croppedBlob, 'logo.jpg');

            const res = await fetch('/api/salon/logo', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setLogoUrl(data.logo_url);
            toast.success('Logo uploaded successfully!');
        } catch (error) {
            console.error('Logo upload error:', error);
            toast.error('Failed to upload logo');
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleRemoveLogo = async () => {
        if (!confirm('Are you sure you want to remove the logo?')) return;

        setIsUploadingLogo(true);
        try {
            const res = await fetch('/api/salon/logo', {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Delete failed');
            }

            setLogoUrl(null);
            toast.success('Logo removed');
        } catch (error) {
            console.error('Logo delete error:', error);
            toast.error('Failed to remove logo');
        } finally {
            setIsUploadingLogo(false);
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
                        {/* Logo Section */}
                        <div className={styles.logoSection}>
                            {logoUrl ? (
                                <div className={styles.logoPreview}>
                                    <img src={logoUrl} alt="Salon Logo" className={styles.logoImage} />
                                    <div className={styles.logoActions}>
                                        <button
                                            className={styles.changeLogoBtn}
                                            onClick={() => setShowLogoCropper(true)}
                                            disabled={isUploadingLogo}
                                        >
                                            Change
                                        </button>
                                        <button
                                            className={styles.removeLogoBtn}
                                            onClick={handleRemoveLogo}
                                            disabled={isUploadingLogo}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className={styles.uploadLogoBtn}
                                    onClick={() => setShowLogoCropper(true)}
                                    disabled={isUploadingLogo}
                                >
                                    {isUploadingLogo ? (
                                        <span className={styles.uploadingText}>Uploading...</span>
                                    ) : (
                                        <>
                                            <span className={styles.uploadIcon}>📷</span>
                                            <span>Upload Logo</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

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
                                <h4>GST Settings</h4>
                                <div className={styles.formGrid}>
                                    <div className={styles.field}>
                                        <label>Enable GST (18%)</label>
                                        <div className={styles.toggleRow}>
                                            <button
                                                type="button"
                                                className={`${styles.toggle} ${formData.gstEnabled ? styles.toggleOn : ''}`}
                                                onClick={() => isEditing && setFormData({ ...formData, gstEnabled: !formData.gstEnabled })}
                                                disabled={!isEditing}
                                            >
                                                <span className={styles.toggleHandle} />
                                            </button>
                                            <span className={styles.toggleLabel}>
                                                {formData.gstEnabled ? 'GST Enabled (18%)' : 'GST Disabled'}
                                            </span>
                                        </div>
                                        <span className={styles.hint}>
                                            When enabled, 18% GST will be applied to all bills
                                        </span>
                                    </div>
                                    <div className={styles.field}>
                                        <label>Address</label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={formData.address}
                                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="Enter salon address"
                                            />
                                        ) : (
                                            <p>{formData.address || 'Not set'}</p>
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

            {/* Logo Cropper Modal */}
            {showLogoCropper && (
                <ImageCropper
                    onImageCropped={handleLogoUpload}
                    onCancel={() => setShowLogoCropper(false)}
                    aspectRatio={1}
                    title="Upload Salon Logo"
                />
            )}
        </>
    );
}
