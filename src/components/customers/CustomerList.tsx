"use client";

import styles from "./CustomerList.module.css";

interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
    tags: string[];
    lastVisit: string;
    totalVisits: number;
    totalSpent: number;
    notes?: string;
}

interface CustomerListProps {
    customers: Customer[];
    selectedId: string | null;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onSelect: (id: string) => void;
}

const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const PlusIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const tagColors: Record<string, { bg: string; color: string }> = {
    VIP: { bg: "linear-gradient(135deg, #F5E6D3, #E8D5B7)", color: "#8B6914" },
    Regular: { bg: "#E8F5E8", color: "#4A7C4A" },
    New: { bg: "#F0F5F9", color: "#5A7A9E" },
};

export default function CustomerList({
    customers,
    selectedId,
    searchQuery,
    onSearchChange,
    onSelect
}: CustomerListProps) {
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase();

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h3 className={styles.title}>All Customers</h3>
                <button className={styles.addBtn}>
                    <PlusIcon />
                </button>
            </div>

            {/* Search */}
            <div className={styles.searchWrapper}>
                <SearchIcon />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {/* List */}
            <div className={styles.list}>
                {filteredCustomers.map(customer => (
                    <div
                        key={customer.id}
                        className={`${styles.item} ${selectedId === customer.id ? styles.selected : ''}`}
                        onClick={() => onSelect(customer.id)}
                    >
                        <div className={styles.avatar}>
                            {getInitials(customer.name)}
                        </div>

                        <div className={styles.info}>
                            <div className={styles.nameRow}>
                                <span className={styles.name}>{customer.name}</span>
                                <span className={styles.lastVisit}>{formatDate(customer.lastVisit)}</span>
                            </div>
                            <span className={styles.phone}>{customer.phone}</span>
                            <div className={styles.tags}>
                                {customer.tags.map(tag => (
                                    <span
                                        key={tag}
                                        className={styles.tag}
                                        style={{
                                            background: tagColors[tag]?.bg || "#EDE6DD",
                                            color: tagColors[tag]?.color || "#6B6560"
                                        }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Stats */}
            <div className={styles.footer}>
                <span>{customers.length} customers</span>
            </div>
        </div>
    );
}
