"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useSession } from "@/lib/SessionContext";
import { db, Staff, Service } from "@/lib/database";
import styles from "./page.module.css";

// Extended roles for salon staff
const STAFF_ROLES = [
    "Hair Stylist",
    "Senior Stylist",
    "Spa Specialist",
    "Nail Technician",
    "Makeup Artist",
    "Barber",
    "Receptionist",
    "Manager",
    "Trainee",
];

type ModalMode = 'add' | 'edit' | 'view' | null;

export default function StaffPage() {
    const router = useRouter();
    const { session } = useSession();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [photoError, setPhotoError] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        role: "Hair Stylist",
        phone: "",
        email: "",
        joiningDate: new Date().toISOString().split('T')[0],
        aadhar: "",
        imageUrl: "",
    });

    useEffect(() => {
        setStaff(db.staff.getAll());
        setServices(db.services.getAll());
        setIsLoading(false);
    }, [router]);

    const filteredStaff = staff.filter(s => {
        if (filter === 'active') return s.isActive;
        if (filter === 'inactive') return !s.isActive;
        return true;
    });

    const openAddModal = () => {
        setFormData({
            name: "",
            role: "Hair Stylist",
            phone: "",
            email: "",
            joiningDate: new Date().toISOString().split('T')[0],
            aadhar: "",
            imageUrl: "",
        });
        setSelectedStaff(null);
        setPhotoError(false);
        setModalMode('add');
    };

    const openEditModal = (member: Staff) => {
        setFormData({
            name: member.name,
            role: member.role,
            phone: member.phone || "",
            email: (member as Staff & { email?: string }).email || "",
            joiningDate: (member as Staff & { joiningDate?: string }).joiningDate || member.createdAt.split('T')[0],
            aadhar: (member as Staff & { aadhar?: string }).aadhar || "",
            imageUrl: member.imageUrl || "",
        });
        setSelectedStaff(member);
        setPhotoError(false);
        setModalMode('edit');
    };

    const openViewModal = (member: Staff) => {
        setSelectedStaff(member);
        setModalMode('view');
    };

    const closeModal = () => {
        setModalMode(null);
        setSelectedStaff(null);
        setShowDeleteConfirm(false);
        setPhotoError(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setFormData({ ...formData, imageUrl: result });
            setPhotoError(false);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setFormData({ ...formData, imageUrl: "" });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSave = () => {
        if (!formData.name.trim()) {
            alert('Please enter staff name');
            return;
        }

        // Check for mandatory photo
        if (!formData.imageUrl) {
            setPhotoError(true);
            return;
        }

        // Use session salon ID
        const salonId = session?.salon?.id;
        if (!salonId) {
            alert('Session not found. Please login again.');
            return;
        }

        if (modalMode === 'add') {
            const created = db.staff.create({
                salonId: salonId,
                name: formData.name,
                role: formData.role,
                phone: formData.phone,
                imageUrl: formData.imageUrl,
                isActive: true,
                serviceIds: [],
            });
            setStaff([...staff, created]);
        } else if (modalMode === 'edit' && selectedStaff) {
            const updated = db.staff.update(selectedStaff.id, {
                name: formData.name,
                role: formData.role,
                phone: formData.phone,
                imageUrl: formData.imageUrl,
            });
            if (updated) {
                setStaff(staff.map(s => s.id === selectedStaff.id ? updated : s));
            }
        }

        closeModal();
    };

    const handleDelete = () => {
        if (!selectedStaff) return;
        db.staff.delete(selectedStaff.id);
        setStaff(staff.filter(s => s.id !== selectedStaff.id));
        closeModal();
    };

    const toggleStatus = (member: Staff) => {
        const updated = db.staff.update(member.id, { isActive: !member.isActive });
        if (updated) {
            setStaff(staff.map(s => s.id === member.id ? updated : s));
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
                    <button className={styles.addBtn} onClick={openAddModal}>
                        + Add Staff
                    </button>
                </div>

                {filteredStaff.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No staff members found</p>
                        <button onClick={openAddModal}>Add your first team member</button>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filteredStaff.map(member => (
                            <div key={member.id} className={styles.card} onClick={() => openViewModal(member)}>
                                <div className={styles.cardHeader}>
                                    {member.imageUrl ? (
                                        <div className={styles.avatarImage}>
                                            <img src={member.imageUrl} alt={member.name} />
                                        </div>
                                    ) : (
                                        <div className={styles.avatar}>{getInitials(member.name)}</div>
                                    )}
                                    <span className={`${styles.statusBadge} ${member.isActive ? styles.active : styles.inactive}`}>
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

                                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                                    <button className={styles.editBtn} onClick={() => openEditModal(member)}>
                                        Edit
                                    </button>
                                    <button
                                        className={styles.toggleBtn}
                                        onClick={() => toggleStatus(member)}
                                    >
                                        {member.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Staff Modal */}
            {(modalMode === 'add' || modalMode === 'edit') && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>{modalMode === 'add' ? 'Add Staff Member' : 'Edit Staff Member'}</h3>
                        <div className={styles.modalForm}>
                            {/* Photo Upload - Mandatory */}
                            <div className={styles.photoSection}>
                                <label>Staff Photo <span className={styles.required}>*</span></label>
                                {formData.imageUrl ? (
                                    <div className={styles.photoPreview}>
                                        <img src={formData.imageUrl} alt="Staff" />
                                        <button type="button" className={styles.removePhoto} onClick={removeImage}>
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        className={`${styles.photoUpload} ${photoError ? styles.error : ''}`}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <span className={styles.uploadIcon}>📷</span>
                                        <span>Click to upload photo</span>
                                        {photoError && <span className={styles.errorText}>Photo is required</span>}
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Full Name *</label>
                                <input
                                    type="text"
                                    placeholder="Enter name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Role *</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        {STAFF_ROLES.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        placeholder="Phone number"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Joining Date</label>
                                    <input
                                        type="date"
                                        value={formData.joiningDate}
                                        onChange={e => setFormData({ ...formData, joiningDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Aadhar Number</label>
                                <input
                                    type="text"
                                    placeholder="XXXX-XXXX-XXXX"
                                    value={formData.aadhar}
                                    onChange={e => setFormData({ ...formData, aadhar: e.target.value })}
                                    maxLength={14}
                                />
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={closeModal}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleSave}>
                                {modalMode === 'add' ? 'Add Staff' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Staff Profile Modal */}
            {modalMode === 'view' && selectedStaff && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.profileModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.profileHeader}>
                            {selectedStaff.imageUrl ? (
                                <div className={styles.profileAvatarImage}>
                                    <img src={selectedStaff.imageUrl} alt={selectedStaff.name} />
                                </div>
                            ) : (
                                <div className={styles.profileAvatar}>
                                    {getInitials(selectedStaff.name)}
                                </div>
                            )}
                            <div className={styles.profileInfo}>
                                <h2>{selectedStaff.name}</h2>
                                <p className={styles.profileRole}>{selectedStaff.role}</p>
                                <span className={`${styles.statusBadge} ${selectedStaff.isActive ? styles.active : styles.inactive}`}>
                                    {selectedStaff.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div className={styles.profileDetails}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Phone</span>
                                <span className={styles.detailValue}>{selectedStaff.phone || 'Not provided'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Joined</span>
                                <span className={styles.detailValue}>
                                    {new Date(selectedStaff.createdAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Total Appointments</span>
                                <span className={styles.detailValue}>{getAppointmentCount(selectedStaff.id)}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Services Assigned</span>
                                <span className={styles.detailValue}>{selectedStaff.serviceIds?.length || 0}</span>
                            </div>
                        </div>

                        <div className={styles.profileActions}>
                            <button className={styles.editBtn} onClick={() => openEditModal(selectedStaff)}>
                                Edit Profile
                            </button>
                            <button
                                className={styles.toggleBtn}
                                onClick={() => {
                                    toggleStatus(selectedStaff);
                                    setSelectedStaff({ ...selectedStaff, isActive: !selectedStaff.isActive });
                                }}
                            >
                                {selectedStaff.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
                                Delete
                            </button>
                        </div>

                        {/* Delete Confirmation */}
                        {showDeleteConfirm && (
                            <div className={styles.deleteConfirm}>
                                <p>Are you sure you want to delete <strong>{selectedStaff.name}</strong>?</p>
                                <p className={styles.deleteWarning}>This action cannot be undone.</p>
                                <div className={styles.deleteActions}>
                                    <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                    <button className={styles.confirmDeleteBtn} onClick={handleDelete}>
                                        Yes, Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
