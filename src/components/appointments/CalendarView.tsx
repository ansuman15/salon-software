"use client";

import styles from "./CalendarView.module.css";

interface CalendarViewProps {
    selectedDate: Date;
}

// Mock staff data
const mockStaff = [
    { id: "1", name: "Santino Tesoro", color: "#D4A5A5" },
    { id: "2", name: "Brintni Landon", color: "#E8D5B7" },
    { id: "3", name: "Tyra Dhillon", color: "#C4B7D1" },
    { id: "4", name: "Kevin Chen", color: "#B8C4B8" },
];

// Mock appointments
const mockAppointments = [
    { id: "1", staffId: "1", startTime: "09:00", endTime: "10:00", service: "Hair Cut", customer: "John Doe" },
    { id: "2", staffId: "1", startTime: "11:00", endTime: "12:30", service: "Hair Color", customer: "Sarah Smith" },
    { id: "3", staffId: "2", startTime: "10:00", endTime: "11:00", service: "Facial", customer: "Mike Johnson" },
    { id: "4", staffId: "3", startTime: "14:00", endTime: "15:00", service: "Manicure", customer: "Emma Wilson" },
    { id: "5", staffId: "4", startTime: "09:30", endTime: "10:30", service: "Beard Trim", customer: "David Brown" },
];

const timeSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

export default function CalendarView({ selectedDate }: CalendarViewProps) {
    const getAppointmentTop = (startTime: string) => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const startHour = 9; // Calendar starts at 9 AM
        return ((hours - startHour) * 60 + minutes) * (60 / 60); // 60px per hour
    };

    const getAppointmentHeight = (startTime: string, endTime: string) => {
        const [startHours, startMinutes] = startTime.split(':').map(Number);
        const [endHours, endMinutes] = endTime.split(':').map(Number);
        const duration = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
        return duration * (60 / 60); // 60px per hour
    };

    return (
        <div className={styles.container}>
            {/* Time column */}
            <div className={styles.timeColumn}>
                <div className={styles.timeHeader}></div>
                {timeSlots.map((time) => (
                    <div key={time} className={styles.timeSlot}>
                        <span>{time}</span>
                    </div>
                ))}
            </div>

            {/* Staff columns */}
            <div className={styles.staffColumns}>
                {mockStaff.map((staff) => (
                    <div key={staff.id} className={styles.staffColumn}>
                        <div className={styles.staffHeader}>
                            <div
                                className={styles.staffAvatar}
                                style={{ background: staff.color }}
                            >
                                {staff.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className={styles.staffName}>{staff.name}</span>
                        </div>

                        <div className={styles.appointmentsArea}>
                            {/* Grid lines */}
                            {timeSlots.map((_, idx) => (
                                <div key={idx} className={styles.gridLine} style={{ top: idx * 60 }}></div>
                            ))}

                            {/* Appointments */}
                            {mockAppointments
                                .filter(apt => apt.staffId === staff.id)
                                .map(apt => (
                                    <div
                                        key={apt.id}
                                        className={styles.appointment}
                                        style={{
                                            top: getAppointmentTop(apt.startTime),
                                            height: getAppointmentHeight(apt.startTime, apt.endTime),
                                            background: `${staff.color}40`,
                                            borderLeft: `3px solid ${staff.color}`,
                                        }}
                                    >
                                        <span className={styles.aptService}>{apt.service}</span>
                                        <span className={styles.aptCustomer}>{apt.customer}</span>
                                        <span className={styles.aptTime}>{apt.startTime} - {apt.endTime}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
