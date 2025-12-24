"use client";

import { useState } from "react";
import styles from "./NewAppointmentModal.module.css";

interface NewAppointmentModalProps {
    onClose: () => void;
    onSave: (appointment: any) => void;
}

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// Mock data
const mockStaff = [
    { id: "1", name: "Santino Tesoro" },
    { id: "2", name: "Brintni Landon" },
    { id: "3", name: "Tyra Dhillon" },
    { id: "4", name: "Kevin Chen" },
];

const mockServices = [
    { id: "1", name: "Hair Cut", duration: 30, price: 500 },
    { id: "2", name: "Hair Color", duration: 90, price: 2000 },
    { id: "3", name: "Facial", duration: 60, price: 1500 },
    { id: "4", name: "Manicure", duration: 45, price: 800 },
    { id: "5", name: "Beard Trim", duration: 20, price: 300 },
];

export default function NewAppointmentModal({ onClose, onSave }: NewAppointmentModalProps) {
    const [formData, setFormData] = useState({
        customerName: "",
        customerPhone: "",
        date: new Date().toISOString().split('T')[0],
        time: "10:00",
        staffId: "",
        serviceIds: [] as string[],
        notes: "",
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const toggleService = (serviceId: string) => {
        setFormData(prev => ({
            ...prev,
            serviceIds: prev.serviceIds.includes(serviceId)
                ? prev.serviceIds.filter(id => id !== serviceId)
                : [...prev.serviceIds, serviceId]
        }));
    };

    const selectedServices = mockServices.filter(s => formData.serviceIds.includes(s.id));
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>New Appointment</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    {/* Customer Info */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Customer</h3>
                        <div className={styles.row}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={formData.customerName}
                                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                    placeholder="Customer name"
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Phone</label>
                                <input
                                    type="tel"
                                    className={styles.input}
                                    value={formData.customerPhone}
                                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                    placeholder="+91 98765 43210"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>When</h3>
                        <div className={styles.row}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Date</label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Time</label>
                                <input
                                    type="time"
                                    className={styles.input}
                                    value={formData.time}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Staff */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Staff</h3>
                        <div className={styles.staffGrid}>
                            {mockStaff.map(staff => (
                                <button
                                    key={staff.id}
                                    type="button"
                                    className={`${styles.staffCard} ${formData.staffId === staff.id ? styles.selected : ''}`}
                                    onClick={() => setFormData({ ...formData, staffId: staff.id })}
                                >
                                    <div className={styles.staffAvatar}>
                                        {staff.name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <span>{staff.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Services */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Services</h3>
                        <div className={styles.servicesList}>
                            {mockServices.map(service => (
                                <label
                                    key={service.id}
                                    className={`${styles.serviceCard} ${formData.serviceIds.includes(service.id) ? styles.selected : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.serviceIds.includes(service.id)}
                                        onChange={() => toggleService(service.id)}
                                        className={styles.checkbox}
                                    />
                                    <div className={styles.serviceInfo}>
                                        <span className={styles.serviceName}>{service.name}</span>
                                        <span className={styles.serviceMeta}>{service.duration} min</span>
                                    </div>
                                    <span className={styles.servicePrice}>₹{service.price}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Notes (Optional)</h3>
                        <textarea
                            className={styles.textarea}
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Any special requests or notes..."
                            rows={3}
                        />
                    </div>

                    {/* Summary */}
                    {selectedServices.length > 0 && (
                        <div className={styles.summary}>
                            <div className={styles.summaryRow}>
                                <span>Duration</span>
                                <span>{totalDuration} min</span>
                            </div>
                            <div className={styles.summaryRow}>
                                <span>Total</span>
                                <span className={styles.totalPrice}>₹{totalPrice}</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={styles.saveBtn}>
                            Book Appointment
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
