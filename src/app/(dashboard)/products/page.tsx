"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

type TabType = 'products' | 'inventory' | 'suppliers' | 'reports';
type ProductType = 'service_use' | 'retail_sale' | 'both';

interface Product {
    id: string;
    name: string;
    category: string | null;
    brand: string | null;
    type: ProductType;
    unit: string;
    cost_price: number | null;
    selling_price: number | null;
    is_active: boolean;
    image_url: string | null;
}

interface InventoryItem {
    id: string;
    product_id: string;
    quantity: number;
    reorder_level: number;
    stock_status: string;
    product: Product;
}

interface Supplier {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    is_active: boolean;
}

interface StockReport {
    product_name: string;
    category: string;
    quantity: number;
    stock_status: string;
    stock_value: number;
}

export default function ProductsPage() {
    const [activeTab, setActiveTab] = useState<TabType>('products');
    const [products, setProducts] = useState<Product[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [stockReport, setStockReport] = useState<StockReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Modals
    const [showProductModal, setShowProductModal] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);

    // Form states
    const [productForm, setProductForm] = useState({
        name: '', category: '', brand: '', type: 'service_use' as ProductType,
        unit: 'pcs', cost_price: '', selling_price: '', image_url: '',
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 5MB limit for product images
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        // Validate file size (5MB limit)
        if (file.size > MAX_IMAGE_SIZE) {
            setError('Image must be under 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProductForm(prev => ({ ...prev, image_url: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setProductForm(prev => ({ ...prev, image_url: '' }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    const [supplierForm, setSupplierForm] = useState({
        name: '', contact_person: '', phone: '', email: '',
    });
    const [adjustForm, setAdjustForm] = useState({
        quantity: '', direction: 'add', reason: '',
    });
    const [purchaseForm, setPurchaseForm] = useState({
        product_id: '', quantity: '', supplier_id: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [inventorySummary, setInventorySummary] = useState({
        total_products: 0, out_of_stock: 0, low_stock: 0, in_stock: 0, total_value: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    // Realtime sync - auto-refresh when data changes in other browsers
    const handleRealtimeUpdate = useCallback(() => {
        loadData();
    }, []);

    useRealtimeSync({ table: 'products', onDataChange: handleRealtimeUpdate });
    useRealtimeSync({ table: 'inventory', onDataChange: handleRealtimeUpdate });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [productsRes, inventoryRes, suppliersRes] = await Promise.all([
                fetch('/api/products?active=false'),
                fetch('/api/inventory'),
                fetch('/api/suppliers'),
            ]);

            if (productsRes.ok) {
                const data = await productsRes.json();
                setProducts(data.data || []);
            }
            if (inventoryRes.ok) {
                const data = await inventoryRes.json();
                setInventory(data.data || []);
                setInventorySummary(data.summary || {});
            }
            if (suppliersRes.ok) {
                const data = await suppliersRes.json();
                setSuppliers(data.data || []);
            }
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const loadStockReport = async () => {
        try {
            const res = await fetch('/api/reports/stock');
            if (res.ok) {
                const data = await res.json();
                setStockReport(data.data || []);
            }
        } catch (err) {
            console.error('Failed to load stock report');
        }
    };

    useEffect(() => {
        if (activeTab === 'reports') {
            loadStockReport();
        }
    }, [activeTab]);

    // Product CRUD
    const handleSaveProduct = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                ...productForm,
                cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : null,
                selling_price: productForm.selling_price ? parseFloat(productForm.selling_price) : null,
            };

            const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
            const method = editingProduct ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                const errorDetails = data.hint ? `${data.error} (Hint: ${data.hint})` : data.error;
                throw new Error(errorDetails || 'Failed to save product');
            }

            setSuccess(data.message);
            setShowProductModal(false);
            resetProductForm();
            loadData();
        } catch (err: unknown) {
            console.error('Product save error:', err);
            setError(err instanceof Error ? err.message : 'Failed to save product');
        } finally {
            setIsSaving(false);
        }
    };

    const resetProductForm = () => {
        setProductForm({
            name: '', category: '', brand: '', type: 'service_use',
            unit: 'pcs', cost_price: '', selling_price: '', image_url: '',
        });
        setEditingProduct(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const openEditProduct = (product: Product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            category: product.category || '',
            brand: product.brand || '',
            type: product.type,
            unit: product.unit,
            cost_price: product.cost_price?.toString() || '',
            selling_price: product.selling_price?.toString() || '',
            image_url: product.image_url || '',
        });
        setShowProductModal(true);
    };

    const openDeleteConfirm = (product: Product) => {
        setProductToDelete(product);
        setShowDeleteConfirm(true);
    };

    const handleDeleteProduct = async () => {
        if (!productToDelete) return;
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/products/${productToDelete.id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete product');
            }
            setSuccess('Product deleted permanently');
            setShowDeleteConfirm(false);
            setProductToDelete(null);
            loadData();
        } catch (err: unknown) {
            console.error('Product delete error:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete product');
        } finally {
            setIsSaving(false);
        }
    };

    // Supplier CRUD
    const handleSaveSupplier = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
            const method = editingSupplier ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(supplierForm),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(data.message);
            setShowSupplierModal(false);
            setSupplierForm({ name: '', contact_person: '', phone: '', email: '' });
            setEditingSupplier(null);
            loadData();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save supplier');
        } finally {
            setIsSaving(false);
        }
    };

    // Manual Adjustment
    const handleAdjust = async () => {
        if (!adjustingItem || !adjustForm.reason.trim()) {
            setError('Reason is required');
            return;
        }
        setIsSaving(true);
        setError(null);
        try {
            const quantityChange = adjustForm.direction === 'add'
                ? parseFloat(adjustForm.quantity)
                : -parseFloat(adjustForm.quantity);

            const res = await fetch('/api/inventory/adjust', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: adjustingItem.product_id,
                    quantity_change: quantityChange,
                    reason: adjustForm.reason,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(data.message);
            setShowAdjustModal(false);
            setAdjustForm({ quantity: '', direction: 'add', reason: '' });
            setAdjustingItem(null);
            loadData();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to adjust inventory');
        } finally {
            setIsSaving(false);
        }
    };

    // Stock Purchase
    const handlePurchase = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/inventory/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: purchaseForm.product_id,
                    quantity: parseFloat(purchaseForm.quantity),
                    supplier_id: purchaseForm.supplier_id || null,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccess(data.message);
            setShowPurchaseModal(false);
            setPurchaseForm({ product_id: '', quantity: '', supplier_id: '' });
            loadData();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to add stock');
        } finally {
            setIsSaving(false);
        }
    };

    // CSV Export
    const exportCSV = () => {
        const headers = ['Product', 'Category', 'Quantity', 'Status', 'Value'];
        const rows = stockReport.map(r => [
            r.product_name, r.category || '', r.quantity, r.stock_status, r.stock_value,
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stock-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Products & Inventory" subtitle="Manage products, stock, and suppliers" />

            <div className={styles.container}>
                {/* Messages */}
                {error && <div className={styles.errorBanner}>{error} <button onClick={() => setError(null)}>✕</button></div>}
                {success && <div className={styles.successBanner}>{success} <button onClick={() => setSuccess(null)}>✕</button></div>}

                {/* Tabs */}
                <div className={styles.tabs}>
                    {(['products', 'inventory', 'suppliers', 'reports'] as TabType[]).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Products Tab */}
                {activeTab === 'products' && (
                    <div className={styles.tabContent}>
                        <div className={styles.toolbar}>
                            <button className={styles.primaryBtn} onClick={() => setShowProductModal(true)}>
                                + Add Product
                            </button>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Type</th>
                                        <th>Unit</th>
                                        <th>Cost</th>
                                        <th>Selling</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(p => (
                                        <tr key={p.id}>
                                            <td><strong>{p.name}</strong>{p.brand && <span className={styles.brand}>{p.brand}</span>}</td>
                                            <td>{p.category || '-'}</td>
                                            <td><span className={styles.typeBadge}>{p.type.replace('_', ' ')}</span></td>
                                            <td>{p.unit}</td>
                                            <td>₹{p.cost_price || 0}</td>
                                            <td>₹{p.selling_price || 0}</td>
                                            <td><span className={`${styles.statusBadge} ${p.is_active ? styles.active : styles.inactive}`}>
                                                {p.is_active ? 'Active' : 'Inactive'}
                                            </span></td>
                                            <td>
                                                <button className={styles.iconBtn} onClick={() => openEditProduct(p)}>✏️</button>
                                                <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => openDeleteConfirm(p)}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Inventory Tab */}
                {activeTab === 'inventory' && (
                    <div className={styles.tabContent}>
                        <div className={styles.summaryCards}>
                            <div className={styles.summaryCard}>
                                <span className={styles.cardValue}>{inventorySummary.total_products}</span>
                                <span className={styles.cardLabel}>Total Products</span>
                            </div>
                            <div className={`${styles.summaryCard} ${styles.danger}`}>
                                <span className={styles.cardValue}>{inventorySummary.out_of_stock}</span>
                                <span className={styles.cardLabel}>Out of Stock</span>
                            </div>
                            <div className={`${styles.summaryCard} ${styles.warning}`}>
                                <span className={styles.cardValue}>{inventorySummary.low_stock}</span>
                                <span className={styles.cardLabel}>Low Stock</span>
                            </div>
                            <div className={styles.summaryCard}>
                                <span className={styles.cardValue}>₹{inventorySummary.total_value?.toLocaleString()}</span>
                                <span className={styles.cardLabel}>Stock Value</span>
                            </div>
                        </div>
                        <div className={styles.toolbar}>
                            <button className={styles.primaryBtn} onClick={() => setShowPurchaseModal(true)}>
                                + Add Stock
                            </button>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Reorder Level</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inventory.map(item => (
                                        <tr key={item.id} className={item.stock_status === 'out_of_stock' ? styles.outOfStock : item.stock_status === 'low_stock' ? styles.lowStock : ''}>
                                            <td><strong>{item.product?.name}</strong></td>
                                            <td>{item.quantity} {item.product?.unit}</td>
                                            <td>{item.reorder_level}</td>
                                            <td>
                                                <span className={`${styles.stockBadge} ${styles[item.stock_status]}`}>
                                                    {item.stock_status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <button className={styles.iconBtn} onClick={() => {
                                                    setAdjustingItem(item);
                                                    setShowAdjustModal(true);
                                                }}>⚙️ Adjust</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Suppliers Tab */}
                {activeTab === 'suppliers' && (
                    <div className={styles.tabContent}>
                        <div className={styles.toolbar}>
                            <button className={styles.primaryBtn} onClick={() => setShowSupplierModal(true)}>
                                + Add Supplier
                            </button>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Contact Person</th>
                                        <th>Phone</th>
                                        <th>Email</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map(s => (
                                        <tr key={s.id}>
                                            <td><strong>{s.name}</strong></td>
                                            <td>{s.contact_person || '-'}</td>
                                            <td>{s.phone || '-'}</td>
                                            <td>{s.email || '-'}</td>
                                            <td>
                                                <button className={styles.iconBtn} onClick={() => {
                                                    setEditingSupplier(s);
                                                    setSupplierForm({
                                                        name: s.name,
                                                        contact_person: s.contact_person || '',
                                                        phone: s.phone || '',
                                                        email: s.email || '',
                                                    });
                                                    setShowSupplierModal(true);
                                                }}>✏️</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Reports Tab */}
                {activeTab === 'reports' && (
                    <div className={styles.tabContent}>
                        <div className={styles.toolbar}>
                            <button className={styles.secondaryBtn} onClick={exportCSV}>
                                📥 Export CSV
                            </button>
                        </div>
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Category</th>
                                        <th>Quantity</th>
                                        <th>Status</th>
                                        <th>Stock Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stockReport.map((r, i) => (
                                        <tr key={i}>
                                            <td>{r.product_name}</td>
                                            <td>{r.category || '-'}</td>
                                            <td>{r.quantity}</td>
                                            <td><span className={`${styles.stockBadge} ${styles[r.stock_status]}`}>{r.stock_status.replace('_', ' ')}</span></td>
                                            <td>₹{r.stock_value?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Product Modal */}
                {showProductModal && (
                    <div className={styles.modalOverlay} onClick={() => { setShowProductModal(false); resetProductForm(); }}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>

                            {/* Image Upload Section */}
                            <div className={styles.photoSection}>
                                <label>Product Photo (Optional, max 5MB)</label>
                                {productForm.image_url ? (
                                    <div className={styles.photoPreview}>
                                        <img src={productForm.image_url} alt="Product" />
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

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Name *</label>
                                    <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Category</label>
                                    <input value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Brand</label>
                                    <input value={productForm.brand} onChange={e => setProductForm({ ...productForm, brand: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Type *</label>
                                    <select value={productForm.type} onChange={e => setProductForm({ ...productForm, type: e.target.value as ProductType })}>
                                        <option value="service_use">Service Use</option>
                                        <option value="retail_sale">Retail Sale</option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Unit *</label>
                                    <select value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })}>
                                        <option value="pcs">Pieces</option>
                                        <option value="ml">Milliliters</option>
                                        <option value="g">Grams</option>
                                        <option value="kg">Kilograms</option>
                                        <option value="L">Liters</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Cost Price</label>
                                    <input type="number" value={productForm.cost_price} onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Selling Price</label>
                                    <input type="number" value={productForm.selling_price} onChange={e => setProductForm({ ...productForm, selling_price: e.target.value })} />
                                </div>
                            </div>
                            <div className={styles.modalActions}>
                                <button className={styles.secondaryBtn} onClick={() => { setShowProductModal(false); resetProductForm(); }}>Cancel</button>
                                <button className={styles.primaryBtn} onClick={handleSaveProduct} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Supplier Modal */}
                {showSupplierModal && (
                    <div className={styles.modalOverlay} onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); }}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Name *</label>
                                    <input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Contact Person</label>
                                    <input value={supplierForm.contact_person} onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Phone</label>
                                    <input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Email</label>
                                    <input type="email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                                </div>
                            </div>
                            <div className={styles.modalActions}>
                                <button className={styles.secondaryBtn} onClick={() => { setShowSupplierModal(false); setEditingSupplier(null); }}>Cancel</button>
                                <button className={styles.primaryBtn} onClick={handleSaveSupplier} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Adjust Inventory Modal */}
                {showAdjustModal && adjustingItem && (
                    <div className={styles.modalOverlay} onClick={() => { setShowAdjustModal(false); setAdjustingItem(null); }}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2>Adjust Inventory</h2>
                            <p>Product: <strong>{adjustingItem.product?.name}</strong></p>
                            <p>Current Stock: <strong>{adjustingItem.quantity} {adjustingItem.product?.unit}</strong></p>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Direction</label>
                                    <select value={adjustForm.direction} onChange={e => setAdjustForm({ ...adjustForm, direction: e.target.value })}>
                                        <option value="add">Add Stock</option>
                                        <option value="reduce">Reduce Stock</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Quantity *</label>
                                    <input type="number" min="0" value={adjustForm.quantity} onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
                                </div>
                                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                    <label>Reason * (required for audit)</label>
                                    <input value={adjustForm.reason} onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="e.g., Damaged goods, count correction..." />
                                </div>
                            </div>
                            <div className={styles.modalActions}>
                                <button className={styles.secondaryBtn} onClick={() => { setShowAdjustModal(false); setAdjustingItem(null); }}>Cancel</button>
                                <button className={styles.primaryBtn} onClick={handleAdjust} disabled={isSaving || !adjustForm.reason}>
                                    {isSaving ? 'Adjusting...' : 'Apply Adjustment'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stock Purchase Modal */}
                {showPurchaseModal && (
                    <div className={styles.modalOverlay} onClick={() => setShowPurchaseModal(false)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2>Add Stock Purchase</h2>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Product *</label>
                                    <select value={purchaseForm.product_id} onChange={e => setPurchaseForm({ ...purchaseForm, product_id: e.target.value })}>
                                        <option value="">Select Product</option>
                                        {products.filter(p => p.is_active).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Quantity *</label>
                                    <input type="number" min="1" value={purchaseForm.quantity} onChange={e => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Supplier</label>
                                    <select value={purchaseForm.supplier_id} onChange={e => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}>
                                        <option value="">Select Supplier (optional)</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className={styles.modalActions}>
                                <button className={styles.secondaryBtn} onClick={() => setShowPurchaseModal(false)}>Cancel</button>
                                <button className={styles.primaryBtn} onClick={handlePurchase} disabled={isSaving || !purchaseForm.product_id || !purchaseForm.quantity}>
                                    {isSaving ? 'Adding...' : 'Add Stock'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && productToDelete && (
                    <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
                        <div className={styles.modal} onClick={e => e.stopPropagation()}>
                            <h2>Delete Product</h2>
                            <p className={styles.deleteWarning}>
                                ⚠️ Are you sure you want to permanently delete <strong>{productToDelete.name}</strong>?
                                This action cannot be undone and will also remove all inventory records for this product.
                            </p>
                            <div className={styles.modalActions}>
                                <button className={styles.secondaryBtn} onClick={() => { setShowDeleteConfirm(false); setProductToDelete(null); }}>Cancel</button>
                                <button className={styles.dangerBtn} onClick={handleDeleteProduct} disabled={isSaving}>
                                    {isSaving ? 'Deleting...' : 'Delete Permanently'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
