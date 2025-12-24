"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Staff, Service } from "@/lib/database";
import styles from "./page.module.css";

export default function StaffPage() {
    const router = useRouter();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStaff, setNewStaff] = useState({ name: "", role: "Stylist", phone: "" });
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

    useEffect(() => {
        if (!db.auth.isOnboardingComplete()) {
            router.push("/onboarding");
            return;
        }

        setStaff(db.staff.getAll());
        setServices(db.services.getAll());
        setIsLoading(false);
    }, [router]);

    const filteredStaff = staff.filter(s => {
        if (filter === 'active') return s.isActive;
        if (filter === 'inactive') return !s.isActive;
        return true;
    });

    const handleAddStaff = () => {
        if (!newStaff.name.trim()) return;

        const salon = db.salon.get();
        if (!salon) return;

        const created = db.staff.create({
            salonId: salon.id,
            name: newStaff.name,
            role: newStaff.role,
            phone: newStaff.phone,
            isActive: true,
            serviceIds: [],
        });

        setStaff([...staff, created]);
        setShowAddModal(false);
        setNewStaff({ name: "", role: "Stylist", phone: "" });
    };

    const toggleStatus = (id: string) => {
        const staffMember = staff.find(s => s.id === id);
        if (!staffMember) return;

        const updated = db.staff.update(id, { isActive: !staffMember.isActive });
        if (updated) {
            setStaff(staff.map(s => s.id === id ? updated : s));
        }
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const getAppointmentCount = (staffId: string) => {
        return db.appointments.getAll().filter(a => a.staffId === staffId).length;
    };

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Staff" subtitle="Manage your team members" />

            <div className={styles.container}>
                <div className={styles.toolbar}>
                    <div className={styles.filters}>
                        <button
                            className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All ({staff.length})
                        </button>
                        <button
                            className={`${styles.filterBtn} ${filter === 'active' ? styles.active : ''}`}
                            onClick={() => setFilter('active')}
                        >
                            Active ({staff.filter(s => s.isActive).length})
                        </button>
                        <button
                            className={`${styles.filterBtn} ${filter === 'inactive' ? styles.active : ''}`}
                            onClick={() => setFilter('inactive')}
                        >
                            Inactive ({staff.filter(s => !s.isActive).length})
                        </button>
                    </div>
                    <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                        + Add Staff
                    </button>
                </div>

                {filteredStaff.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No staff members found</p>
                        <button onClick={() => setShowAddModal(true)}>Add your first team member</button>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filteredStaff.map(member => (
                            <div key={member.id} className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.avatar}>{getInitials(member.name)}</div>
                                    <span className={`${styles.status} ${member.isActive ? styles.active : styles.inactive}`}>
                                        {member.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <h3 className={styles.name}>{member.name}</h3>
                                <p className={styles.role}>{member.role}</p>
                                {member.phone && <p className={styles.phone}>{member.phone}</p>}

                                <div className={styles.stats}>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{getAppointmentCount(member.id)}</span>
                                        <span className={styles.statLabel}>Appointments</span>
                                    </div>
                                    <div className={styles.stat}>
                                        <span className={styles.statValue}>{member.serviceIds?.length || 0}</span>
                                        <span className={styles.statLabel}>Services</span>
                                    </div>
                                </div>

                                <div className={styles.cardActions}>
                                    <button
                                        className={styles.toggleBtn}
                                        onClick={() => toggleStatus(member.id)}
                                    >
                                        {member.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Staff Modal */}
            {showAddModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Add Staff Member</h3>
                        <div className={styles.modalForm}>
                            <input
                                type="text"
                                placeholder="Name *"
                                value={newStaff.name}
                                onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                            />
                            <select
                                value={newStaff.role}
                                onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}
                            >
                                <option value="Stylist">Stylist</option>
                                <option value="Therapist">Therapist</option>
                                <option value="Barber">Barber</option>
                                <option value="Receptionist">Receptionist</option>
                                <option value="Manager">Manager</option>
                            </select>
                            <input
                                type="tel"
                                placeholder="Phone (optional)"
                                value={newStaff.phone}
                                onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleAddStaff}>Add Staff</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
