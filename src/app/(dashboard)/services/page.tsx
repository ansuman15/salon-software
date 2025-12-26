"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useSession } from "@/lib/SessionContext";
import { db, Service } from "@/lib/database";
import styles from "./page.module.css";

const categories = ["All", "Hair", "Skin", "Nails", "Spa", "Bridal", "Other"];

export default function ServicesPage() {
    const router = useRouter();
    const { session } = useSession();
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [activeCategory, setActiveCategory] = useState("All");

    const [formData, setFormData] = useState({
        name: "",
        category: "Hair",
        durationMinutes: 30,
        price: 500,
        description: "",
        imageUrl: "",
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setServices(db.services.getAll());
        setIsLoading(false);
    }, [router]);

    const filteredServices = services.filter(s =>
        activeCategory === "All" || s.category === activeCategory
    );

    const resetForm = () => {
        setFormData({
            name: "",
            category: "Hair",
            durationMinutes: 30,
            price: 500,
            description: "",
            imageUrl: "",
        });
    };

    const handleAddService = () => {
        if (!formData.name.trim()) {
            alert('Please enter a service name');
            return;
        }

        // Use session salon ID instead of db.salon.get()
        const salonId = session?.salon?.id;
        if (!salonId) {
            alert('Session not found. Please login again.');
            return;
        }

        const created = db.services.create({
            salonId: salonId,
            name: formData.name,
            category: formData.category,
            durationMinutes: formData.durationMinutes,
            price: formData.price,
            description: formData.description || undefined,
            imageUrl: formData.imageUrl || undefined,
            isActive: true,
        });

        setServices([...services, created]);
        setShowAddModal(false);
        resetForm();
    };

    const openEditModal = (service: Service) => {
        setSelectedService(service);
        setFormData({
            name: service.name,
            category: service.category,
            durationMinutes: service.durationMinutes,
            price: service.price,
            description: service.description || "",
            imageUrl: service.imageUrl || "",
        });
        setShowEditModal(true);
    };

    const handleEditService = () => {
        if (!selectedService || !formData.name.trim()) return;

        const updated = db.services.update(selectedService.id, {
            name: formData.name,
            category: formData.category,
            durationMinutes: formData.durationMinutes,
            price: formData.price,
            description: formData.description || undefined,
            imageUrl: formData.imageUrl || undefined,
        });

        if (updated) {
            setServices(services.map(s => s.id === selectedService.id ? updated : s));
        }
        setShowEditModal(false);
        setSelectedService(null);
        resetForm();
    };

    const openDeleteConfirm = (service: Service) => {
        setSelectedService(service);
        setShowDeleteConfirm(true);
    };

    const handleDeleteService = () => {
        if (!selectedService) return;

        const success = db.services.delete(selectedService.id);
        if (success) {
            setServices(services.filter(s => s.id !== selectedService.id));
        }
        setShowDeleteConfirm(false);
        setSelectedService(null);
    };

    const toggleService = (id: string) => {
        const service = services.find(s => s.id === id);
        if (!service) return;

        const updated = db.services.update(id, { isActive: !service.isActive });
        if (updated) {
            setServices(services.map(s => s.id === id ? updated : s));
        }
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
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setFormData({ ...formData, imageUrl: "" });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
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

    const ServiceModal = ({ isEdit }: { isEdit: boolean }) => (
        <div className={styles.modalOverlay} onClick={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); }}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3>{isEdit ? 'Edit Service' : 'Add New Service'}</h3>
                <div className={styles.modalForm}>
                    {/* Photo Upload */}
                    <div className={styles.photoSection}>
                        <label>Service Photo (Optional)</label>
                        {formData.imageUrl ? (
                            <div className={styles.photoPreview}>
                                <img src={formData.imageUrl} alt="Service" />
                                <button type="button" className={styles.removePhoto} onClick={removeImage}>
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className={styles.photoUpload} onClick={() => fileInputRef.current?.click()}>
                                <span className={styles.uploadIcon}>📷</span>
                                <span>Click to upload photo</span>
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

                    <input
                        type="text"
                        placeholder="Service Name *"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                    <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
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
                                value={formData.durationMinutes}
                                onChange={e => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                            />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Price (₹)</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                    <textarea
                        placeholder="Description (optional)"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>
                <div className={styles.modalActions}>
                    <button onClick={() => { isEdit ? setShowEditModal(false) : setShowAddModal(false); resetForm(); }}>
                        Cancel
                    </button>
                    <button
                        className={styles.primaryBtn}
                        onClick={isEdit ? handleEditService : handleAddService}
                    >
                        {isEdit ? 'Save Changes' : 'Add Service'}
                    </button>
                </div>
            </div>
        </div>
    );

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
                                {service.imageUrl && (
                                    <div className={styles.cardImage}>
                                        <img src={service.imageUrl} alt={service.name} />
                                    </div>
                                )}
                                <div className={styles.cardContent}>
                                    <div className={styles.cardHeader}>
                                        <span className={styles.category}>{service.category}</span>
                                        <span className={styles.duration}>{formatDuration(service.durationMinutes)}</span>
                                    </div>
                                    <h3 className={styles.serviceName}>{service.name}</h3>
                                    {service.description && <p className={styles.description}>{service.description}</p>}
                                    <div className={styles.cardFooter}>
                                        <span className={styles.price}>₹{service.price.toLocaleString()}</span>
                                        <div className={styles.cardActions}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => openEditModal(service)}
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => openDeleteConfirm(service)}
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                            <button
                                                className={styles.toggleBtn}
                                                onClick={() => toggleService(service.id)}
                                            >
                                                {service.isActive ? 'Disable' : 'Enable'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Service Modal */}
            {showAddModal && <ServiceModal isEdit={false} />}

            {/* Edit Service Modal */}
            {showEditModal && <ServiceModal isEdit={true} />}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && selectedService && (
                <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
                    <div className={styles.deleteModal} onClick={e => e.stopPropagation()}>
                        <h3>Delete Service</h3>
                        <p>Are you sure you want to delete <strong>{selectedService.name}</strong>?</p>
                        <p className={styles.warning}>This action cannot be undone.</p>
                        <div className={styles.modalActions}>
                            <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                            <button className={styles.dangerBtn} onClick={handleDeleteService}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
