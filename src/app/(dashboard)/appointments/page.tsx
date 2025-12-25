"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Appointment, Customer, Staff, Service } from "@/lib/database";
import styles from "./page.module.css";

type ViewMode = 'day' | 'week';
type ModalMode = 'add' | 'edit' | null;

export default function AppointmentsPage() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    const [formData, setFormData] = useState({
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

    const openAddModal = () => {
        setFormData({
            customerId: "",
            customerName: "",
            customerPhone: "",
            staffId: "",
            date: getDateStr(selectedDate),
            time: "10:00",
            serviceIds: [],
            notes: "",
        });
        setSelectedAppointment(null);
        setModalMode('add');
    };

    const openEditModal = (apt: Appointment) => {
        setFormData({
            customerId: apt.customerId,
            customerName: "",
            customerPhone: "",
            staffId: apt.staffId,
            date: apt.appointmentDate,
            time: apt.startTime,
            serviceIds: apt.serviceIds,
            notes: apt.notes || "",
        });
        setSelectedAppointment(apt);
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setSelectedAppointment(null);
        setShowCancelModal(false);
        setCancelReason("");
    };

    const handleSave = () => {
        const salon = db.salon.get();
        if (!salon || !formData.staffId || formData.serviceIds.length === 0) return;

        // Calculate end time based on services
        const totalDuration = formData.serviceIds.reduce((sum, id) => {
            const service = services.find(s => s.id === id);
            return sum + (service?.durationMinutes || 30);
        }, 0);

        const [hours, mins] = formData.time.split(':').map(Number);
        const endMins = hours * 60 + mins + totalDuration;
        const endTime = `${Math.floor(endMins / 60).toString().padStart(2, '0')}:${(endMins % 60).toString().padStart(2, '0')}`;

        if (modalMode === 'add') {
            // Create or find customer
            let customerId = formData.customerId;
            if (!customerId && formData.customerName && formData.customerPhone) {
                const newCustomer = db.customers.create({
                    salonId: salon.id,
                    name: formData.customerName,
                    phone: formData.customerPhone,
                    tags: ["New"],
                });
                customerId = newCustomer.id;
            }
            if (!customerId) return;

            const created = db.appointments.create({
                salonId: salon.id,
                customerId,
                staffId: formData.staffId,
                appointmentDate: formData.date,
                startTime: formData.time,
                endTime,
                status: "confirmed",
                serviceIds: formData.serviceIds,
                notes: formData.notes,
            });

            setAppointments([...appointments, created]);
        } else if (modalMode === 'edit' && selectedAppointment) {
            const updated = db.appointments.update(selectedAppointment.id, {
                staffId: formData.staffId,
                appointmentDate: formData.date,
                startTime: formData.time,
                endTime,
                serviceIds: formData.serviceIds,
                notes: formData.notes,
            });

            if (updated) {
                setAppointments(appointments.map(a => a.id === selectedAppointment.id ? updated : a));
            }
        }

        closeModal();
    };

    const handleCancel = () => {
        if (!selectedAppointment) return;

        const updated = db.appointments.update(selectedAppointment.id, {
            status: "cancelled",
            notes: cancelReason ? `${selectedAppointment.notes || ''}\n[Cancelled: ${cancelReason}]`.trim() : selectedAppointment.notes,
        });

        if (updated) {
            setAppointments(appointments.map(a => a.id === selectedAppointment.id ? updated : a));
        }

        closeModal();
    };

    const toggleService = (serviceId: string) => {
        setFormData(prev => ({
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

                    <button className={styles.addBtn} onClick={openAddModal}>
                        + New Appointment
                    </button>
                </div>

                {todayAppointments.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No appointments for {formatDate(selectedDate)}</p>
                        <button onClick={openAddModal}>Book an appointment</button>
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
                                                    <button onClick={() => openEditModal(apt)}>Edit</button>
                                                    <button onClick={() => updateStatus(apt.id, 'completed')}>Complete</button>
                                                    <button
                                                        className={styles.cancelBtn}
                                                        onClick={() => {
                                                            setSelectedAppointment(apt);
                                                            setShowCancelModal(true);
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}
                                            {apt.status === 'completed' && (
                                                <span className={styles.completedText}>✓ Done</span>
                                            )}
                                            {apt.status === 'cancelled' && (
                                                <button onClick={() => updateStatus(apt.id, 'confirmed')}>Restore</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Appointment Modal */}
            {modalMode && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>{modalMode === 'add' ? 'New Appointment' : 'Edit Appointment'}</h3>
                        <div className={styles.modalForm}>
                            {modalMode === 'add' && (
                                <>
                                    <div className={styles.inputGroup}>
                                        <label>Customer</label>
                                        <select
                                            value={formData.customerId}
                                            onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                        >
                                            <option value="">-- Select or add new --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {!formData.customerId && (
                                        <div className={styles.newCustomer}>
                                            <input
                                                type="text"
                                                placeholder="Customer Name"
                                                value={formData.customerName}
                                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                            />
                                            <input
                                                type="tel"
                                                placeholder="Phone"
                                                value={formData.customerPhone}
                                                onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {modalMode === 'edit' && selectedAppointment && (
                                <div className={styles.editCustomerInfo}>
                                    <strong>Customer:</strong> {getCustomerName(selectedAppointment.customerId)}
                                </div>
                            )}

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Time</label>
                                    <input
                                        type="time"
                                        value={formData.time}
                                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Staff</label>
                                <select
                                    value={formData.staffId}
                                    onChange={e => setFormData({ ...formData, staffId: e.target.value })}
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
                                            className={`${styles.serviceBtn} ${formData.serviceIds.includes(s.id) ? styles.selected : ''}`}
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
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={closeModal}>Cancel</button>
                            <button
                                className={styles.primaryBtn}
                                onClick={handleSave}
                                disabled={!formData.staffId || formData.serviceIds.length === 0}
                            >
                                {modalMode === 'add' ? 'Book Appointment' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelModal && selectedAppointment && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.cancelModal} onClick={e => e.stopPropagation()}>
                        <h3>Cancel Appointment</h3>
                        <p>Are you sure you want to cancel this appointment?</p>
                        <div className={styles.cancelInfo}>
                            <strong>{getCustomerName(selectedAppointment.customerId)}</strong>
                            <span>{selectedAppointment.appointmentDate} at {selectedAppointment.startTime}</span>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Reason (optional)</label>
                            <textarea
                                placeholder="e.g., Customer no-show, Rescheduled..."
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={closeModal}>Keep Appointment</button>
                            <button className={styles.dangerBtn} onClick={handleCancel}>
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
