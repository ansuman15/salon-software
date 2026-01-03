"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/layout/Header";
import { useSession } from "@/lib/SessionContext";
import { useToast } from "@/components/ui/Toast";
import styles from "./page.module.css";

export default function SettingsPage() {
    const { session, loading, refresh } = useSession();
    const toast = useToast();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [logoUploading, setLogoUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state with defaults
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        city: '',
        currency: 'INR',
        openingTime: '09:00',
        closingTime: '21:00',
        workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
        gstPercentage: 18,
        invoicePrefix: 'INV',
        whatsappEnabled: false,
        whatsappNumber: '',
    });

    // Load initial data from session when available
    useEffect(() => {
        if (session?.salon) {
            setFormData(prev => ({
                ...prev,
                name: session.salon?.name || '',
                phone: session.salon?.phone || '',
                city: session.salon?.city || '',
            }));
            // Set logo preview if exists
            if (session.salon?.logo_url) {
                setPreviewUrl(session.salon.logo_url);
            }
        }
    }, [session]);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const handleChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    const toggleDay = (dayIndex: number) => {
        const newDays = formData.workingDays.includes(dayIndex)
            ? formData.workingDays.filter(d => d !== dayIndex)
            : [...formData.workingDays, dayIndex].sort();
        setFormData({ ...formData, workingDays: newDays });
    };

    // Logo upload handler
    const handleLogoUpload = async (file: File) => {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Use JPG, PNG, WebP, or SVG.');
            return;
        }

        // Validate file size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File too large. Maximum size is 2MB.');
            return;
        }

        setLogoUploading(true);

        try {
            // Show preview immediately
            const reader = new FileReader();
            reader.onload = (e) => setPreviewUrl(e.target?.result as string);
            reader.readAsDataURL(file);

            // Upload to API
            const formData = new FormData();
            formData.append('logo', file);

            const res = await fetch('/api/salon/logo', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to upload logo');
            }

            toast.success('Logo uploaded successfully!');
            setPreviewUrl(data.logo_url);

            // Refresh session to update sidebar
            if (refresh) {
                await refresh();
            }
        } catch (error) {
            console.error('Logo upload error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to upload logo');
            // Revert preview
            setPreviewUrl(session?.salon?.logo_url || null);
        } finally {
            setLogoUploading(false);
        }
    };

    // Logo delete handler
    const handleLogoDelete = async () => {
        if (!previewUrl) return;

        setLogoUploading(true);

        try {
            const res = await fetch('/api/salon/logo', {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to remove logo');
            }

            toast.success('Logo removed!');
            setPreviewUrl(null);

            if (refresh) {
                await refresh();
            }
        } catch (error) {
            console.error('Logo delete error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to remove logo');
        } finally {
            setLogoUploading(false);
        }
    };

    // File input change handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleLogoUpload(file);
        }
    };

    // Drag and drop handlers
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleLogoUpload(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleSave = async () => {
        setSaveStatus('saving');

        try {
            console.log('[Settings] Saving settings...', formData);

            const res = await fetch('/api/salon', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                    city: formData.city,
                    gst_percentage: formData.gstPercentage,
                }),
            });

            const data = await res.json();
            console.log('[Settings] Save response:', data);

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save settings');
            }

            setSaveStatus('saved');
            toast.success('Settings saved successfully!');

            // Refresh session to get updated data
            if (refresh) {
                await refresh();
            }

            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('[Settings] Save error:', error);
            setSaveStatus('error');
            toast.error(error instanceof Error ? error.message : 'Failed to save settings');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    if (loading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Settings" subtitle="Configure your salon" />

            <div className={styles.container}>
                {/* Logo Upload Section */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Salon Logo</h3>
                    <div className={styles.logoUploadContainer}>
                        <div
                            className={`${styles.logoDropzone} ${logoUploading ? styles.uploading : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} alt="Salon Logo" className={styles.logoPreview} />
                            ) : (
                                <div className={styles.logoPlaceholder}>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <polyline points="21 15 16 10 5 21" />
                                    </svg>
                                    <span>Click or drag to upload logo</span>
                                    <small>JPG, PNG, WebP, SVG • Max 2MB</small>
                                </div>
                            )}
                            {logoUploading && (
                                <div className={styles.uploadingOverlay}>
                                    <div className={styles.spinner}></div>
                                </div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className={styles.hiddenInput}
                        />
                        {previewUrl && !logoUploading && (
                            <button
                                type="button"
                                className={styles.deleteLogoBtn}
                                onClick={handleLogoDelete}
                            >
                                Remove Logo
                            </button>
                        )}
                    </div>
                </section>

                {/* Salon Info */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Salon Information</h3>
                    <div className={styles.grid}>
                        <div className={styles.inputGroup}>
                            <label>Salon Name</label>
                            <input
                                type="text"
                                value={session?.salon?.name || formData.name}
                                onChange={e => handleChange('name', e.target.value)}
                                placeholder="Enter salon name"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={e => handleChange('phone', e.target.value)}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>City</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={e => handleChange('city', e.target.value)}
                                placeholder="Enter city"
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Currency</label>
                            <select
                                value={formData.currency}
                                onChange={e => handleChange('currency', e.target.value)}
                            >
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Working Hours */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Working Hours</h3>
                    <div className={styles.grid}>
                        <div className={styles.inputGroup}>
                            <label>Opening Time</label>
                            <input
                                type="time"
                                value={formData.openingTime}
                                onChange={e => handleChange('openingTime', e.target.value)}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Closing Time</label>
                            <input
                                type="time"
                                value={formData.closingTime}
                                onChange={e => handleChange('closingTime', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Working Days</label>
                        <div className={styles.daysGrid}>
                            {days.map((day, idx) => (
                                <button
                                    key={day}
                                    type="button"
                                    className={`${styles.dayBtn} ${formData.workingDays.includes(idx) ? styles.active : ''}`}
                                    onClick={() => toggleDay(idx)}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Billing Settings */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Billing & Tax</h3>
                    <div className={styles.grid}>
                        <div className={styles.inputGroup}>
                            <label>GST Percentage (%)</label>
                            <input
                                type="number"
                                value={formData.gstPercentage}
                                onChange={e => handleChange('gstPercentage', Number(e.target.value))}
                                min={0}
                                max={100}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Invoice Prefix</label>
                            <input
                                type="text"
                                value={formData.invoicePrefix}
                                onChange={e => handleChange('invoicePrefix', e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                {/* WhatsApp */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>WhatsApp Integration</h3>
                    <div className={styles.toggleRow}>
                        <div className={styles.toggleInfo}>
                            <span className={styles.toggleLabel}>Enable WhatsApp Notifications</span>
                            <span className={styles.toggleDesc}>Send booking confirmations and reminders</span>
                        </div>
                        <button
                            type="button"
                            className={`${styles.toggle} ${formData.whatsappEnabled ? styles.on : ''}`}
                            onClick={() => handleChange('whatsappEnabled', !formData.whatsappEnabled)}
                        >
                            <span className={styles.toggleKnob}></span>
                        </button>
                    </div>
                    {formData.whatsappEnabled && (
                        <div className={styles.inputGroup}>
                            <label>WhatsApp Business Number</label>
                            <input
                                type="tel"
                                value={formData.whatsappNumber}
                                onChange={e => handleChange('whatsappNumber', e.target.value)}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                    )}
                </section>

                {/* Save Button */}
                <div className={styles.actions}>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                    >
                        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved!' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
