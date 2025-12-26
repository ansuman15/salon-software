"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { useSession } from "@/lib/SessionContext";
import styles from "./page.module.css";

export default function SettingsPage() {
    const { session, loading } = useSession();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

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

    const handleSave = async () => {
        setSaveStatus('saving');

        // TODO: Implement API call to update settings in Supabase
        // For now, just show saved status
        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 500);
    };

    if (loading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Settings" subtitle="Configure your salon" />

            <div className={styles.container}>
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
