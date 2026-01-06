"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useSession } from "@/lib/SessionContext";
import { useToast } from "@/components/ui/Toast";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

interface Staff {
    id: string;
    name: string;
    phone?: string;
    role: string;
    imageUrl?: string;
    isActive: boolean;
    serviceIds: string[];
    createdAt: string;
}

interface Service {
    id: string;
    name: string;
}

interface StaffMetrics {
    staff_id: string;
    bills_created: number;
    services_performed: number;
    products_sold: number;
    revenue_generated: number;
    appointments_completed: number;
}

interface RecentInvoice {
    id: string;
    invoice_number: string;
    total_amount: number;
    created_at: string;
    customer?: { id: string; name: string };
}

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
    const toast = useToast();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [photoError, setPhotoError] = useState(false);

    // Staff metrics state
    const [staffMetrics, setStaffMetrics] = useState<StaffMetrics | null>(null);
    const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

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
        loadStaff();
    }, []);

    // Realtime sync - auto-refresh when data changes in other browsers
    const handleRealtimeUpdate = useCallback(() => {
        loadStaff();
    }, []);

    useRealtimeSync({ table: 'staff', onDataChange: handleRealtimeUpdate });

    const loadStaff = async () => {
        setIsLoading(true);
        try {
            const [staffRes, servicesRes] = await Promise.all([
                fetch('/api/staff'),
                fetch('/api/services')
            ]);

            if (staffRes.ok) {
                const data = await staffRes.json();
                setStaff(data.staff || []);
            }

            if (servicesRes.ok) {
                const data = await servicesRes.json();
                setServices(data.services || []);
            }
        } catch (error) {
            console.error('Error loading staff:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

    const openViewModal = async (member: Staff) => {
        setSelectedStaff(member);
        setModalMode('view');
        setStaffMetrics(null);
        setRecentInvoices([]);

        // Fetch staff metrics
        setIsLoadingMetrics(true);
        try {
            const res = await fetch(`/api/staff/${member.id}/metrics`);
            if (res.ok) {
                const data = await res.json();
                setStaffMetrics(data.metrics);
                setRecentInvoices(data.recent_invoices || []);
            }
        } catch (error) {
            console.error('Error loading staff metrics:', error);
        } finally {
            setIsLoadingMetrics(false);
        }
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

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Please enter staff name');
            return;
        }

        // Check for mandatory photo
        if (!formData.imageUrl) {
            setPhotoError(true);
            toast.error('Please upload a photo');
            return;
        }

        // Check for mandatory Aadhar number
        if (!formData.aadhar || formData.aadhar.trim().length < 12) {
            toast.error('Please enter a valid Aadhar number (12 digits)');
            return;
        }

        setIsSaving(true);

        try {
            if (modalMode === 'add') {
                const res = await fetch('/api/staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.name,
                        role: formData.role,
                        phone: formData.phone,
                        imageUrl: formData.imageUrl,
                        serviceIds: [],
                    }),
                });

                const data = await res.json();

                if (res.status === 401) {
                    toast.error('Session expired. Please login again.');
                    router.push('/login');
                    return;
                }

                if (res.ok && data.success) {
                    setStaff(prev => [...prev, data.staff]);
                    toast.success(`Staff "${data.staff.name}" added successfully!`);
                    closeModal();
                } else {
                    toast.error(data.error || 'Failed to add staff');
                }
            } else if (modalMode === 'edit' && selectedStaff) {
                const res = await fetch('/api/staff', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: selectedStaff.id,
                        name: formData.name,
                        role: formData.role,
                        phone: formData.phone,
                        imageUrl: formData.imageUrl,
                    }),
                });

                const data = await res.json();

                if (res.status === 401) {
                    toast.error('Session expired. Please login again.');
                    router.push('/login');
                    return;
                }

                if (res.ok && data.success) {
                    setStaff(prev => prev.map(s => s.id === selectedStaff.id ? data.staff : s));
                    toast.success('Staff updated successfully!');
                    closeModal();
                } else {
                    toast.error(data.error || 'Failed to update staff');
                }
            }
        } catch (error) {
            console.error('Save staff error:', error);
            toast.error('Failed to save staff. Please check your connection and try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedStaff) return;

        setIsSaving(true);

        try {
            const res = await fetch(`/api/staff?id=${selectedStaff.id}`, {
                method: 'DELETE',
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStaff(prev => prev.filter(s => s.id !== selectedStaff.id));
                toast.success('Staff member removed successfully!');
                closeModal();
            } else {
                toast.error(data.error || 'Failed to delete staff');
            }
        } catch (error) {
            console.error('Delete staff error:', error);
            toast.error('Failed to delete staff. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (member: Staff) => {
        try {
            const res = await fetch('/api/staff', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: member.id,
                    isActive: !member.isActive,
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setStaff(prev => prev.map(s => s.id === member.id ? data.staff : s));
                toast.success(data.staff.isActive ? 'Staff activated' : 'Staff deactivated');
            } else {
                toast.error(data.error || 'Failed to update staff status');
            }
        } catch (error) {
            console.error('Toggle staff status error:', error);
            toast.error('Failed to update staff status');
        }
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const getAppointmentCount = (staffId: string) => {
        // TODO: Fetch appointment count from API when needed
        return 0;
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
                                <label>Aadhar Number <span className={styles.required}>*</span></label>
                                <input
                                    type="text"
                                    placeholder="XXXX-XXXX-XXXX"
                                    value={formData.aadhar}
                                    onChange={e => setFormData({ ...formData, aadhar: e.target.value })}
                                    maxLength={14}
                                    required
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
                                <span className={styles.detailLabel}>Services Assigned</span>
                                <span className={styles.detailValue}>
                                    {staffMetrics ? staffMetrics.services_performed : (selectedStaff.serviceIds?.length || 0)}
                                </span>
                            </div>
                        </div>

                        {/* Performance Metrics Section */}
                        <div className={styles.metricsSection}>
                            <h4 className={styles.sectionTitle}>Performance Metrics</h4>
                            {isLoadingMetrics ? (
                                <div className={styles.metricsLoading}>Loading metrics...</div>
                            ) : staffMetrics ? (
                                <div className={styles.metricsGrid}>
                                    <div className={styles.metricCard}>
                                        <span className={styles.metricValue}>{staffMetrics.appointments_completed}</span>
                                        <span className={styles.metricLabel}>Appointments</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <span className={styles.metricValue}>{staffMetrics.services_performed}</span>
                                        <span className={styles.metricLabel}>Services Done</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <span className={styles.metricValue}>{staffMetrics.products_sold}</span>
                                        <span className={styles.metricLabel}>Products Sold</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <span className={styles.metricValue}>₹{staffMetrics.revenue_generated.toLocaleString()}</span>
                                        <span className={styles.metricLabel}>Revenue</span>
                                    </div>
                                    <div className={styles.metricCard}>
                                        <span className={styles.metricValue}>{staffMetrics.bills_created}</span>
                                        <span className={styles.metricLabel}>Bills Created</span>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.metricsEmpty}>Unable to load performance metrics</div>
                            )}
                        </div>

                        {/* Recent Invoices Section */}
                        {recentInvoices.length > 0 && (
                            <div className={styles.recentInvoices}>
                                <h4 className={styles.sectionTitle}>Recent Bills Created</h4>
                                <div className={styles.invoicesList}>
                                    {recentInvoices.map(invoice => (
                                        <div key={invoice.id} className={styles.invoiceItem}>
                                            <div className={styles.invoiceMain}>
                                                <span className={styles.invoiceNumber}>{invoice.invoice_number}</span>
                                                <span className={styles.invoiceAmount}>₹{invoice.total_amount.toLocaleString()}</span>
                                            </div>
                                            <div className={styles.invoiceMeta}>
                                                <span>{invoice.customer?.name || 'Walk-in'}</span>
                                                <span>{new Date(invoice.created_at).toLocaleDateString('en-IN')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
