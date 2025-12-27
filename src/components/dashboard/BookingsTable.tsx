"use client";

// Force rebuild - no database imports here
import { useState } from "react";
import Link from "next/link";
import styles from "./BookingsTable.module.css";

interface Appointment {
    id: string;
    employeeName: string;
    service: string;
    status: string;
    time: string;
    customerName: string;
}

interface Customer {
    id: string;
    name: string;
    phone?: string;
}

interface Staff {
    id: string;
    name: string;
    role?: string;
}

interface Service {
    id: string;
    name: string;
    price?: number;
}

interface BookingsTableProps {
    appointments: Appointment[];
    customers: Customer[];
    staff: Staff[];
    services: Service[];
}

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

type Tab = 'upcoming' | 'all' | 'cancelled';

export default function BookingsTable({ appointments, customers, staff, services }: BookingsTableProps) {
    const [activeTab, setActiveTab] = useState<Tab>('upcoming');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAppointments = appointments.filter(apt => {
        const matchesTab =
            activeTab === 'all' ? true :
                activeTab === 'cancelled' ? apt.status === 'cancelled' :
                    apt.status === 'confirmed';

        const matchesSearch =
            apt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            apt.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            apt.service.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesTab && matchesSearch;
    });

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'confirmed': return styles.confirmed;
            case 'completed': return styles.completed;
            case 'cancelled': return styles.cancelled;
            case 'no_show': return styles.noShow;
            default: return '';
        }
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3 className={styles.title}>Today's Appointments</h3>

                <div className={styles.controls}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'upcoming' ? styles.active : ''}`}
                            onClick={() => setActiveTab('upcoming')}
                        >
                            Upcoming
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'cancelled' ? styles.active : ''}`}
                            onClick={() => setActiveTab('cancelled')}
                        >
                            Cancelled
                        </button>
                    </div>

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
                </div>
            </div>

            {filteredAppointments.length === 0 ? (
                <div className={styles.empty}>
                    <p>No appointments found</p>
                    <Link href="/appointments" className={styles.emptyLink}>
                        + Book an appointment
                    </Link>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Staff</th>
                                <th>Service</th>
                                <th>Time</th>
                                <th>Customer</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.map((apt) => (
                                <tr key={apt.id}>
                                    <td>
                                        <div className={styles.staffCell}>
                                            <div className={styles.avatar}>{getInitials(apt.employeeName)}</div>
                                            <span>{apt.employeeName}</span>
                                        </div>
                                    </td>
                                    <td>{apt.service}</td>
                                    <td>{apt.time}</td>
                                    <td>{apt.customerName}</td>
                                    <td>
                                        <span className={`${styles.status} ${getStatusClass(apt.status)}`}>
                                            {apt.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className={styles.footer}>
                <span>{filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}</span>
                <Link href="/appointments" className={styles.viewAll}>View all →</Link>
            </div>
        </div>
    );
}
