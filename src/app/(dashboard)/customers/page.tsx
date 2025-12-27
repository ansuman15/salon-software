"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import BulkImportModal, { CustomerData } from "@/components/customers/BulkImportModal";
import { useSession } from "@/lib/SessionContext";
import { useToast } from "@/components/ui/Toast";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { db, Customer } from "@/lib/database";
import styles from "./page.module.css";

export default function CustomersPage() {
    const router = useRouter();
    const { session } = useSession();
    const toast = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "" });
    const [editCustomer, setEditCustomer] = useState({ name: "", phone: "", email: "", notes: "", tags: [] as string[] });

    useEffect(() => {
        loadCustomers();
    }, []);

    // Realtime sync - auto-refresh when data changes in other browsers
    const handleRealtimeUpdate = useCallback(() => {
        loadCustomers();
    }, []);

    useRealtimeSync({ table: 'customers', onDataChange: handleRealtimeUpdate });

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            // Try to fetch from Supabase API first
            const res = await fetch('/api/customers');
            if (res.ok) {
                const data = await res.json();
                const cloudCustomers = data.customers || [];
                setCustomers(cloudCustomers);
                if (cloudCustomers.length > 0 && !selectedCustomer) {
                    setSelectedCustomer(cloudCustomers[0]);
                }
            } else {
                // Fallback to localStorage if API fails
                const localData = db.customers.getAll();
                setCustomers(localData);
                if (localData.length > 0 && !selectedCustomer) {
                    setSelectedCustomer(localData[0]);
                }
            }
        } catch (error) {
            console.error('Error loading customers:', error);
            // Fallback to localStorage
            const localData = db.customers.getAll();
            setCustomers(localData);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    const handleAddCustomer = async () => {
        if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
            toast.error('Please enter name and phone number');
            return;
        }

        const salonId = session?.salon?.id;
        if (!salonId) {
            toast.error('Session not found. Please login again.');
            return;
        }

        setIsSaving(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 300));

            const created = db.customers.create({
                salonId: salonId,
                name: newCustomer.name,
                phone: newCustomer.phone,
                email: newCustomer.email,
                notes: newCustomer.notes,
                tags: ["New"],
            });

            setCustomers([...customers, created]);
            setSelectedCustomer(created);
            setShowAddModal(false);
            setNewCustomer({ name: "", phone: "", email: "", notes: "" });
            toast.success(`Customer "${created.name}" added successfully!`);
        } catch (error) {
            toast.error('Failed to add customer. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditClick = () => {
        if (!selectedCustomer) return;
        setEditCustomer({
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email || "",
            notes: selectedCustomer.notes || "",
            tags: selectedCustomer.tags || [],
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = () => {
        if (!selectedCustomer || !editCustomer.name.trim() || !editCustomer.phone.trim()) return;

        const updated = db.customers.update(selectedCustomer.id, {
            name: editCustomer.name,
            phone: editCustomer.phone,
            email: editCustomer.email || undefined,
            notes: editCustomer.notes || undefined,
            tags: editCustomer.tags,
        });

        if (updated) {
            setCustomers(customers.map(c => c.id === selectedCustomer.id ? updated : c));
            setSelectedCustomer(updated);
        }
        setShowEditModal(false);
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = () => {
        if (!selectedCustomer) return;

        const success = db.customers.delete(selectedCustomer.id);
        if (success) {
            const remaining = customers.filter(c => c.id !== selectedCustomer.id);
            setCustomers(remaining);
            setSelectedCustomer(remaining.length > 0 ? remaining[0] : null);
        }
        setShowDeleteConfirm(false);
    };

    const handleBookAppointment = () => {
        if (!selectedCustomer) return;
        // Store customer context for appointments page
        localStorage.setItem('salonx_book_for_customer', JSON.stringify({
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
        }));
        router.push('/appointments');
    };

    const handleSendMessage = () => {
        if (!selectedCustomer) return;
        // Format phone number for WhatsApp
        let phone = selectedCustomer.phone.replace(/\s+/g, '').replace(/-/g, '');
        // Add country code if not present
        if (!phone.startsWith('+')) {
            phone = '+91' + phone; // Default to India
        }
        phone = phone.replace('+', '');
        // Open WhatsApp with pre-filled message
        const message = encodeURIComponent(`Hi ${selectedCustomer.name.split(' ')[0]}, greetings from ${db.salon.get()?.name || 'our salon'}!`);
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

    const handleBulkImport = async (importedCustomers: CustomerData[]) => {
        if (importedCustomers.length === 0) {
            toast.error('No customers to import');
            return;
        }

        setIsSaving(true);

        try {
            // Send to Supabase API
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customers: importedCustomers.map(c => ({
                        name: c.name,
                        phone: c.phone,
                        email: c.email,
                        notes: c.notes,
                        tags: ['Imported']
                    }))
                }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Update local state with imported customers from API response
                const newCustomers = data.customers || [];
                setCustomers(prev => [...newCustomers, ...prev]);

                if (newCustomers.length > 0 && !selectedCustomer) {
                    setSelectedCustomer(newCustomers[0]);
                }

                toast.success(`Successfully imported ${data.imported} customers!`);

                if (data.failed > 0) {
                    toast.info(`${data.failed} rows skipped (missing name or phone)`);
                }
            } else {
                toast.error(data.error || 'Failed to import customers');
            }
        } catch (error) {
            console.error('Bulk import error:', error);
            toast.error('Failed to import customers. Please try again.');
        } finally {
            setIsSaving(false);
            setShowBulkImport(false);
        }
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const getVisitCount = (customerId: string) => {
        return db.appointments.getByCustomer(customerId).filter(a => a.status === 'completed').length;
    };

    const getTotalSpent = (customerId: string) => {
        const bills = db.bills.getByCustomer(customerId);
        return bills.reduce((sum, b) => sum + b.finalAmount, 0);
    };

    const toggleTag = (tag: string) => {
        setEditCustomer(prev => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter(t => t !== tag)
                : [...prev.tags, tag],
        }));
    };

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Customers" subtitle="Manage your customer database" />

            <div className={styles.container}>
                {/* Customer List */}
                <div className={styles.listPanel}>
                    <div className={styles.listHeader}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                            + Add
                        </button>
                    </div>

                    <div className={styles.bulkActions}>
                        <button className={styles.bulkImportBtn} onClick={() => setShowBulkImport(true)}>
                            📤 Import CSV/Excel
                        </button>
                    </div>

                    <div className={styles.list}>
                        {filteredCustomers.length === 0 ? (
                            <div className={styles.empty}>
                                <p>No customers yet</p>
                                <button onClick={() => setShowAddModal(true)}>Add your first customer</button>
                            </div>
                        ) : (
                            filteredCustomers.map(customer => (
                                <div
                                    key={customer.id}
                                    className={`${styles.customerCard} ${selectedCustomer?.id === customer.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedCustomer(customer)}
                                >
                                    <div className={styles.avatar}>{getInitials(customer.name)}</div>
                                    <div className={styles.customerInfo}>
                                        <span className={styles.customerName}>{customer.name}</span>
                                        <span className={styles.customerPhone}>{customer.phone}</span>
                                    </div>
                                    {customer.tags && customer.tags.length > 0 && (
                                        <span className={`${styles.tag} ${styles[customer.tags[0].toLowerCase()]}`}>
                                            {customer.tags[0]}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Customer Detail */}
                <div className={styles.detailPanel}>
                    {selectedCustomer ? (
                        <>
                            <div className={styles.detailHeader}>
                                <div className={styles.detailAvatar}>{getInitials(selectedCustomer.name)}</div>
                                <div>
                                    <h2 className={styles.detailName}>{selectedCustomer.name}</h2>
                                    <p className={styles.detailPhone}>{selectedCustomer.phone}</p>
                                    {selectedCustomer.email && <p className={styles.detailEmail}>{selectedCustomer.email}</p>}
                                </div>
                                <div className={styles.detailActions}>
                                    <button className={styles.editBtn} onClick={handleEditClick} title="Edit">
                                        ✏️
                                    </button>
                                    <button className={styles.deleteBtn} onClick={handleDeleteClick} title="Delete">
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
                                <div className={styles.tagsRow}>
                                    {selectedCustomer.tags.map(tag => (
                                        <span key={tag} className={`${styles.tagLarge} ${styles[tag.toLowerCase()]}`}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className={styles.statsRow}>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>{getVisitCount(selectedCustomer.id)}</span>
                                    <span className={styles.statLabel}>Visits</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>₹{getTotalSpent(selectedCustomer.id).toLocaleString()}</span>
                                    <span className={styles.statLabel}>Total Spent</span>
                                </div>
                                <div className={styles.stat}>
                                    <span className={styles.statValue}>
                                        {new Date(selectedCustomer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                    </span>
                                    <span className={styles.statLabel}>Member Since</span>
                                </div>
                            </div>

                            {selectedCustomer.notes && (
                                <div className={styles.notesSection}>
                                    <h4>Notes</h4>
                                    <p>{selectedCustomer.notes}</p>
                                </div>
                            )}

                            <div className={styles.actions}>
                                <button className={styles.actionBtn} onClick={handleBookAppointment}>
                                    📅 Book Appointment
                                </button>
                                <button className={styles.actionBtnSecondary} onClick={handleSendMessage}>
                                    💬 Send Message
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className={styles.noSelection}>
                            <p>Select a customer to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Add New Customer</h3>
                        <div className={styles.modalForm}>
                            <input
                                type="text"
                                placeholder="Customer Name *"
                                value={newCustomer.name}
                                onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                            />
                            <input
                                type="tel"
                                placeholder="Phone Number *"
                                value={newCustomer.phone}
                                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                            />
                            <input
                                type="email"
                                placeholder="Email (optional)"
                                value={newCustomer.email}
                                onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                            />
                            <textarea
                                placeholder="Notes (optional)"
                                value={newCustomer.notes}
                                onChange={e => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleAddCustomer}>Add Customer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Customer Modal */}
            {showEditModal && selectedCustomer && (
                <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Edit Customer</h3>
                        <div className={styles.modalForm}>
                            <input
                                type="text"
                                placeholder="Customer Name *"
                                value={editCustomer.name}
                                onChange={e => setEditCustomer({ ...editCustomer, name: e.target.value })}
                            />
                            <input
                                type="tel"
                                placeholder="Phone Number *"
                                value={editCustomer.phone}
                                onChange={e => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                            />
                            <input
                                type="email"
                                placeholder="Email (optional)"
                                value={editCustomer.email}
                                onChange={e => setEditCustomer({ ...editCustomer, email: e.target.value })}
                            />
                            <textarea
                                placeholder="Notes (optional)"
                                value={editCustomer.notes}
                                onChange={e => setEditCustomer({ ...editCustomer, notes: e.target.value })}
                            />
                            <div className={styles.tagSelector}>
                                <label>Tags:</label>
                                <div className={styles.tagOptions}>
                                    {['VIP', 'Regular', 'New', 'Imported'].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            className={`${styles.tagOption} ${editCustomer.tags.includes(tag) ? styles.selected : ''}`}
                                            onClick={() => toggleTag(tag)}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowEditModal(false)}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleSaveEdit}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedCustomer && (
                <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
                    <div className={styles.deleteModal} onClick={e => e.stopPropagation()}>
                        <h3>Delete Customer</h3>
                        <p>Are you sure you want to delete <strong>{selectedCustomer.name}</strong>?</p>
                        <p className={styles.warning}>This action cannot be undone.</p>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className={styles.dangerBtn} onClick={handleConfirmDelete}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkImport && (
                <BulkImportModal
                    onClose={() => setShowBulkImport(false)}
                    onImport={handleBulkImport}
                />
            )}
        </>
    );
}
