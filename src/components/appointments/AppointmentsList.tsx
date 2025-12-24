"use client";

import styles from "./AppointmentsList.module.css";

interface AppointmentsListProps {
    selectedDate: Date;
}

// Generate week dates
const getWeekDates = (date: Date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        week.push(d);
    }
    return week;
};

// Mock appointments for the week
const mockWeekAppointments = [
    { id: "1", date: "2024-12-23", startTime: "09:00", service: "Hair Cut", customer: "John Doe", staff: "Santino Tesoro", status: "confirmed" },
    { id: "2", date: "2024-12-23", startTime: "11:00", service: "Hair Color", customer: "Sarah Smith", staff: "Santino Tesoro", status: "confirmed" },
    { id: "3", date: "2024-12-24", startTime: "10:00", service: "Facial", customer: "Mike Johnson", staff: "Brintni Landon", status: "completed" },
    { id: "4", date: "2024-12-25", startTime: "14:00", service: "Manicure", customer: "Emma Wilson", staff: "Tyra Dhillon", status: "confirmed" },
    { id: "5", date: "2024-12-26", startTime: "09:30", service: "Beard Trim", customer: "David Brown", staff: "Kevin Chen", status: "cancelled" },
];

const statusColors: Record<string, string> = {
    confirmed: "var(--success)",
    completed: "var(--info)",
    cancelled: "var(--error)",
    no_show: "var(--warning)",
};

export default function AppointmentsList({ selectedDate }: AppointmentsListProps) {
    const weekDates = getWeekDates(selectedDate);

    const formatDay = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const formatDate = (date: Date) => {
        return date.getDate();
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    return (
        <div className={styles.container}>
            {/* Week header */}
            <div className={styles.weekHeader}>
                {weekDates.map((date, idx) => (
                    <div
                        key={idx}
                        className={`${styles.dayHeader} ${isToday(date) ? styles.today : ''}`}
                    >
                        <span className={styles.dayName}>{formatDay(date)}</span>
                        <span className={styles.dayNumber}>{formatDate(date)}</span>
                    </div>
                ))}
            </div>

            {/* Week grid */}
            <div className={styles.weekGrid}>
                {weekDates.map((date, idx) => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayAppointments = mockWeekAppointments.filter(a => a.date === dateStr);

                    return (
                        <div key={idx} className={styles.dayColumn}>
                            {dayAppointments.length > 0 ? (
                                dayAppointments.map(apt => (
                                    <div key={apt.id} className={styles.aptCard}>
                                        <div
                                            className={styles.statusDot}
                                            style={{ background: statusColors[apt.status] }}
                                        ></div>
                                        <div className={styles.aptContent}>
                                            <span className={styles.aptTime}>{apt.startTime}</span>
                                            <span className={styles.aptService}>{apt.service}</span>
                                            <span className={styles.aptCustomer}>{apt.customer}</span>
                                            <span className={styles.aptStaff}>{apt.staff}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyDay}>
                                    <span>No appointments</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
