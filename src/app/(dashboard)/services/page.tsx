"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Service } from "@/lib/database";
import styles from "./page.module.css";

const categories = ["All", "Hair", "Skin", "Nails", "Spa", "Bridal", "Other"];

export default function ServicesPage() {
    const router = useRouter();
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeCategory, setActiveCategory] = useState("All");
    const [newService, setNewService] = useState({
        name: "",
        category: "Hair",
        durationMinutes: 30,
        price: 500,
        description: ""
    });

    useEffect(() => {
        setServices(db.services.getAll());
        setIsLoading(false);
    }, [router]);

    const filteredServices = services.filter(s =>
        activeCategory === "All" || s.category === activeCategory
    );

    const handleAddService = () => {
        if (!newService.name.trim()) return;

        const salon = db.salon.get();
        if (!salon) return;

        const created = db.services.create({
            salonId: salon.id,
            name: newService.name,
            category: newService.category,
            durationMinutes: newService.durationMinutes,
            price: newService.price,
            description: newService.description,
            isActive: true,
        });

        setServices([...services, created]);
        setShowAddModal(false);
        setNewService({ name: "", category: "Hair", durationMinutes: 30, price: 500, description: "" });
    };

    const toggleService = (id: string) => {
        const service = services.find(s => s.id === id);
        if (!service) return;

        const updated = db.services.update(id, { isActive: !service.isActive });
        if (updated) {
            setServices(services.map(s => s.id === id ? updated : s));
        }
    };

    const formatDuration = (mins: number) => {
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remaining = mins % 60;
            return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
        }
        return `${mins}m`;
    };

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Services & Pricing" subtitle="Manage your service menu" />

            <div className={styles.container}>
                <div className={styles.toolbar}>
                    <div className={styles.categories}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`${styles.categoryBtn} ${activeCategory === cat ? styles.active : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                        + Add Service
                    </button>
                </div>

                {filteredServices.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No services in this category</p>
                        <button onClick={() => setShowAddModal(true)}>Add your first service</button>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filteredServices.map(service => (
                            <div key={service.id} className={`${styles.card} ${!service.isActive ? styles.inactive : ''}`}>
                                <div className={styles.cardHeader}>
                                    <span className={styles.category}>{service.category}</span>
                                    <span className={styles.duration}>{formatDuration(service.durationMinutes)}</span>
                                </div>
                                <h3 className={styles.serviceName}>{service.name}</h3>
                                {service.description && <p className={styles.description}>{service.description}</p>}
                                <div className={styles.cardFooter}>
                                    <span className={styles.price}>₹{service.price.toLocaleString()}</span>
                                    <button
                                        className={styles.toggleBtn}
                                        onClick={() => toggleService(service.id)}
                                    >
                                        {service.isActive ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Service Modal */}
            {showAddModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Add New Service</h3>
                        <div className={styles.modalForm}>
                            <input
                                type="text"
                                placeholder="Service Name *"
                                value={newService.name}
                                onChange={e => setNewService({ ...newService, name: e.target.value })}
                            />
                            <select
                                value={newService.category}
                                onChange={e => setNewService({ ...newService, category: e.target.value })}
                            >
                                <option value="Hair">Hair</option>
                                <option value="Skin">Skin</option>
                                <option value="Nails">Nails</option>
                                <option value="Spa">Spa</option>
                                <option value="Bridal">Bridal</option>
                                <option value="Other">Other</option>
                            </select>
                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label>Duration (min)</label>
                                    <input
                                        type="number"
                                        value={newService.durationMinutes}
                                        onChange={e => setNewService({ ...newService, durationMinutes: Number(e.target.value) })}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Price (₹)</label>
                                    <input
                                        type="number"
                                        value={newService.price}
                                        onChange={e => setNewService({ ...newService, price: Number(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <textarea
                                placeholder="Description (optional)"
                                value={newService.description}
                                onChange={e => setNewService({ ...newService, description: e.target.value })}
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleAddService}>Add Service</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
