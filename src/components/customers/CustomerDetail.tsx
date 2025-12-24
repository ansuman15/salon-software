"use client";

import styles from "./CustomerDetail.module.css";

interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    tags: string[];
    lastVisit: string;
    totalVisits: number;
    totalSpent: number;
    notes?: string;
}

interface CustomerDetailProps {
    customer: Customer | undefined;
    onClose: () => void;
}

// Mock visit history
const mockVisitHistory = [
    { id: "1", date: "2024-12-20", services: ["Hair Cut", "Beard Trim"], amount: 800, staff: "Santino Tesoro" },
    { id: "2", date: "2024-12-05", services: ["Hair Color"], amount: 2000, staff: "Brintni Landon" },
    { id: "3", date: "2024-11-22", services: ["Hair Cut"], amount: 500, staff: "Santino Tesoro" },
    { id: "4", date: "2024-11-08", services: ["Facial", "Hair Cut"], amount: 2000, staff: "Tyra Dhillon" },
];

const PhoneIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const EmailIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const WhatsAppIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.59-1.204A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.003 0-3.868-.592-5.432-1.61l-.389-.232-4.038 1.06 1.078-3.937-.254-.408A9.956 9.956 0 012 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
);

const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

export default function CustomerDetail({ customer, onClose }: CustomerDetailProps) {
    if (!customer) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>👤</div>
                <h3>Select a customer</h3>
                <p>Choose a customer from the list to view their profile and history</p>
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase();

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.avatar}>
                    {getInitials(customer.name)}
                </div>
                <div className={styles.headerInfo}>
                    <h2 className={styles.name}>{customer.name}</h2>
                    <div className={styles.tags}>
                        {customer.tags.map(tag => (
                            <span key={tag} className={`${styles.tag} ${styles[tag.toLowerCase()]}`}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
                <button className={styles.editBtn}>
                    <EditIcon />
                    Edit
                </button>
            </div>

            {/* Contact */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Contact</h3>
                <div className={styles.contactGrid}>
                    <a href={`tel:${customer.phone}`} className={styles.contactItem}>
                        <PhoneIcon />
                        <span>{customer.phone}</span>
                    </a>
                    {customer.email && (
                        <a href={`mailto:${customer.email}`} className={styles.contactItem}>
                            <EmailIcon />
                            <span>{customer.email}</span>
                        </a>
                    )}
                    <button className={styles.whatsappBtn}>
                        <WhatsAppIcon />
                        <span>Send Message</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Overview</h3>
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{customer.totalVisits}</span>
                        <span className={styles.statLabel}>Total Visits</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>₹{customer.totalSpent.toLocaleString()}</span>
                        <span className={styles.statLabel}>Total Spent</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{formatDate(customer.lastVisit)}</span>
                        <span className={styles.statLabel}>Last Visit</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {customer.notes && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Notes & Preferences</h3>
                    <p className={styles.notes}>{customer.notes}</p>
                </div>
            )}

            {/* Visit History (Timeline) */}
            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Visit History</h3>
                <div className={styles.timeline}>
                    {mockVisitHistory.map((visit, idx) => (
                        <div key={visit.id} className={styles.timelineItem}>
                            <div className={styles.timelineDot}></div>
                            {idx < mockVisitHistory.length - 1 && <div className={styles.timelineLine}></div>}
                            <div className={styles.timelineContent}>
                                <div className={styles.timelineHeader}>
                                    <span className={styles.timelineDate}>{formatDate(visit.date)}</span>
                                    <span className={styles.timelineAmount}>₹{visit.amount}</span>
                                </div>
                                <div className={styles.timelineServices}>
                                    {visit.services.join(", ")}
                                </div>
                                <div className={styles.timelineStaff}>by {visit.staff}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
                <button className={styles.bookBtn}>Book Appointment</button>
            </div>
        </div>
    );
}
