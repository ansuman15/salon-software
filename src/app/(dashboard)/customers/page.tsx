"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Customer } from "@/lib/database";
import styles from "./page.module.css";

export default function CustomersPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "", notes: "" });

    useEffect(() => {
        if (!db.auth.isOnboardingComplete()) {
            router.push("/onboarding");
            return;
        }
        loadCustomers();
    }, [router]);

    const loadCustomers = () => {
        const data = db.customers.getAll();
        setCustomers(data);
        if (data.length > 0 && !selectedCustomer) {
            setSelectedCustomer(data[0]);
        }
        setIsLoading(false);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    const handleAddCustomer = () => {
        if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;

        const salon = db.salon.get();
        if (!salon) return;

        const created = db.customers.create({
            salonId: salon.id,
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
                            </div>

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
                                <button className={styles.actionBtn}>Book Appointment</button>
                                <button className={styles.actionBtnSecondary}>Send Message</button>
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
        </>
    );
}
