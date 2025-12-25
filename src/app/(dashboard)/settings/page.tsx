"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Salon, Settings } from "@/lib/database";
import styles from "./page.module.css";

export default function SettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [salon, setSalon] = useState<Salon | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    useEffect(() => {
        setSalon(db.salon.get());
        setSettings(db.settings.get());
        setIsLoading(false);
    }, [router]);

    const handleSalonChange = (field: keyof Salon, value: string) => {
        if (!salon) return;
        setSalon({ ...salon, [field]: value });
    };

    const handleSettingsChange = (field: keyof Settings, value: any) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    const toggleDay = (dayIndex: number) => {
        if (!settings) return;
        const newDays = settings.workingDays.includes(dayIndex)
            ? settings.workingDays.filter(d => d !== dayIndex)
            : [...settings.workingDays, dayIndex].sort();
        setSettings({ ...settings, workingDays: newDays });
    };

    const handleSave = () => {
        setSaveStatus('saving');

        if (salon) {
            db.salon.update(salon);
        }

        if (settings) {
            db.settings.save(settings);
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    if (isLoading || !salon || !settings) {
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
                                value={salon.name}
                                onChange={e => handleSalonChange('name', e.target.value)}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={salon.phone}
                                onChange={e => handleSalonChange('phone', e.target.value)}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>City</label>
                            <input
                                type="text"
                                value={salon.city}
                                onChange={e => handleSalonChange('city', e.target.value)}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Currency</label>
                            <select
                                value={salon.currency}
                                onChange={e => handleSalonChange('currency', e.target.value)}
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
                                value={settings.openingTime}
                                onChange={e => handleSettingsChange('openingTime', e.target.value)}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Closing Time</label>
                            <input
                                type="time"
                                value={settings.closingTime}
                                onChange={e => handleSettingsChange('closingTime', e.target.value)}
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
                                    className={`${styles.dayBtn} ${settings.workingDays.includes(idx) ? styles.active : ''}`}
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
                                value={settings.gstPercentage}
                                onChange={e => handleSettingsChange('gstPercentage', Number(e.target.value))}
                                min={0}
                                max={100}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Invoice Prefix</label>
                            <input
                                type="text"
                                value={settings.invoicePrefix}
                                onChange={e => handleSettingsChange('invoicePrefix', e.target.value)}
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
                            className={`${styles.toggle} ${settings.whatsappEnabled ? styles.on : ''}`}
                            onClick={() => handleSettingsChange('whatsappEnabled', !settings.whatsappEnabled)}
                        >
                            <span className={styles.toggleKnob}></span>
                        </button>
                    </div>
                    {settings.whatsappEnabled && (
                        <div className={styles.inputGroup}>
                            <label>WhatsApp Business Number</label>
                            <input
                                type="tel"
                                value={settings.whatsappNumber || ''}
                                onChange={e => handleSettingsChange('whatsappNumber', e.target.value)}
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
