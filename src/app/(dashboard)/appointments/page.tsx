"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Appointment, Customer, Staff, Service } from "@/lib/database";
import styles from "./page.module.css";

type ViewMode = 'day' | 'week';

export default function AppointmentsPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAppointment, setNewAppointment] = useState({
        customerId: "",
        customerName: "",
        customerPhone: "",
        staffId: "",
        date: new Date().toISOString().split('T')[0],
        time: "10:00",
        serviceIds: [] as string[],
        notes: "",
    });

    useEffect(() => {
        if (!db.auth.isOnboardingComplete()) {
            router.push("/onboarding");
            return;
        }

        loadData();
    }, [router]);

    const loadData = () => {
        setAppointments(db.appointments.getAll());
        setCustomers(db.customers.getAll());
        setStaff(db.staff.getAll().filter(s => s.isActive));
        setServices(db.services.getAll().filter(s => s.isActive));
        setIsLoading(false);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getDateStr = (date: Date) => date.toISOString().split('T')[0];

    const navigateDate = (direction: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + direction);
        setSelectedDate(newDate);
    };

    const todayAppointments = appointments.filter(a => a.appointmentDate === getDateStr(selectedDate));

    const handleAddAppointment = () => {
        const salon = db.salon.get();
        if (!salon || !newAppointment.staffId || newAppointment.serviceIds.length === 0) return;

        // Create or find customer
        let customerId = newAppointment.customerId;
        if (!customerId && newAppointment.customerName && newAppointment.customerPhone) {
            const newCustomer = db.customers.create({
                salonId: salon.id,
                name: newAppointment.customerName,
                phone: newAppointment.customerPhone,
                tags: ["New"],
            });
            customerId = newCustomer.id;
        }

        if (!customerId) return;

        // Calculate end time based on services
        const totalDuration = newAppointment.serviceIds.reduce((sum, id) => {
            const service = services.find(s => s.id === id);
            return sum + (service?.durationMinutes || 30);
        }, 0);

        const [hours, mins] = newAppointment.time.split(':').map(Number);
        const endMins = hours * 60 + mins + totalDuration;
        const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;

        const created = db.appointments.create({
            salonId: salon.id,
            customerId,
            staffId: newAppointment.staffId,
            appointmentDate: newAppointment.date,
            startTime: newAppointment.time,
            endTime,
            status: "confirmed",
            serviceIds: newAppointment.serviceIds,
            notes: newAppointment.notes,
        });

        setAppointments([...appointments, created]);
        setShowAddModal(false);
        setNewAppointment({
            customerId: "",
            customerName: "",
            customerPhone: "",
            staffId: "",
            date: new Date().toISOString().split('T')[0],
            time: "10:00",
            serviceIds: [],
            notes: "",
        });
    };

    const toggleService = (serviceId: string) => {
        setNewAppointment(prev => ({
            ...prev,
            serviceIds: prev.serviceIds.includes(serviceId)
                ? prev.serviceIds.filter(id => id !== serviceId)
                : [...prev.serviceIds, serviceId]
        }));
    };

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown';
    const getStaffName = (id: string) => staff.find(s => s.id === id)?.name || 'Unknown';
    const getServiceNames = (ids: string[]) => ids.map(id => services.find(s => s.id === id)?.name || '').filter(Boolean).join(', ');
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const updateStatus = (id: string, status: Appointment['status']) => {
        const updated = db.appointments.update(id, { status });
        if (updated) {
            setAppointments(appointments.map(a => a.id === id ? updated : a));
        }
    };

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Appointments" subtitle="Manage your schedule" />

            <div className={styles.container}>
                <div className={styles.toolbar}>
                    <div className={styles.dateNav}>
                        <button className={styles.navBtn} onClick={() => navigateDate(-1)}>←</button>
                        <span className={styles.currentDate}>{formatDate(selectedDate)}</span>
                        <button className={styles.navBtn} onClick={() => navigateDate(1)}>→</button>
                        <button className={styles.todayBtn} onClick={() => setSelectedDate(new Date())}>Today</button>
                    </div>

                    <div className={styles.viewToggle}>
                        <button
                            className={`${styles.viewBtn} ${viewMode === 'day' ? styles.active : ''}`}
                            onClick={() => setViewMode('day')}
                        >
                            Day
                        </button>
                        <button
                            className={`${styles.viewBtn} ${viewMode === 'week' ? styles.active : ''}`}
                            onClick={() => setViewMode('week')}
                        >
                            Week
                        </button>
                    </div>

                    <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                        + New Appointment
                    </button>
                </div>

                {todayAppointments.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No appointments for {formatDate(selectedDate)}</p>
                        <button onClick={() => setShowAddModal(true)}>Book an appointment</button>
                    </div>
                ) : (
                    <div className={styles.appointmentsList}>
                        {todayAppointments
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map(apt => (
                                <div key={apt.id} className={`${styles.appointmentCard} ${styles[apt.status]}`}>
                                    <div className={styles.timeSlot}>
                                        <span className={styles.time}>{apt.startTime}</span>
                                        <span className={styles.duration}>to {apt.endTime}</span>
                                    </div>
                                    <div className={styles.appointmentDetails}>
                                        <div className={styles.customerRow}>
                                            <div className={styles.avatar}>{getInitials(getCustomerName(apt.customerId))}</div>
                                            <div>
                                                <span className={styles.customerName}>{getCustomerName(apt.customerId)}</span>
                                                <span className={styles.staffName}>with {getStaffName(apt.staffId)}</span>
                                            </div>
                                        </div>
                                        <div className={styles.services}>{getServiceNames(apt.serviceIds)}</div>
                                        {apt.notes && <p className={styles.notes}>{apt.notes}</p>}
                                    </div>
                                    <div className={styles.statusActions}>
                                        <span className={`${styles.status} ${styles[apt.status]}`}>
                                            {apt.status.replace('_', ' ')}
                                        </span>
                                        <div className={styles.actions}>
                                            {apt.status === 'confirmed' && (
                                                <>
                                                    <button onClick={() => updateStatus(apt.id, 'completed')}>Complete</button>
                                                    <button onClick={() => updateStatus(apt.id, 'cancelled')}>Cancel</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* Add Appointment Modal */}
            {showAddModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>New Appointment</h3>
                        <div className={styles.modalForm}>
                            <div className={styles.inputGroup}>
                                <label>Customer</label>
                                <select
                                    value={newAppointment.customerId}
                                    onChange={e => setNewAppointment({ ...newAppointment, customerId: e.target.value })}
                                >
                                    <option value="">-- Select or add new --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                                    ))}
                                </select>
                            </div>

                            {!newAppointment.customerId && (
                                <div className={styles.newCustomer}>
                                    <input
                                        type="text"
                                        placeholder="Customer Name"
                                        value={newAppointment.customerName}
                                        onChange={e => setNewAppointment({ ...newAppointment, customerName: e.target.value })}
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={newAppointment.customerPhone}
                                        onChange={e => setNewAppointment({ ...newAppointment, customerPhone: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={newAppointment.date}
                                        onChange={e => setNewAppointment({ ...newAppointment, date: e.target.value })}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Time</label>
                                    <input
                                        type="time"
                                        value={newAppointment.time}
                                        onChange={e => setNewAppointment({ ...newAppointment, time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Staff</label>
                                <select
                                    value={newAppointment.staffId}
                                    onChange={e => setNewAppointment({ ...newAppointment, staffId: e.target.value })}
                                >
                                    <option value="">-- Select staff --</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Services</label>
                                <div className={styles.serviceGrid}>
                                    {services.map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`${styles.serviceBtn} ${newAppointment.serviceIds.includes(s.id) ? styles.selected : ''}`}
                                            onClick={() => toggleService(s.id)}
                                        >
                                            {s.name}
                                            <span>₹{s.price}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <textarea
                                placeholder="Notes (optional)"
                                value={newAppointment.notes}
                                onChange={e => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button
                                className={styles.primaryBtn}
                                onClick={handleAddAppointment}
                                disabled={!newAppointment.staffId || newAppointment.serviceIds.length === 0}
                            >
                                Book Appointment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
