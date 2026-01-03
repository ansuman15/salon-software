"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import Invoice from "@/components/Invoice";
import { useSession } from "@/lib/SessionContext";
import { useToast } from "@/components/ui/Toast";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

interface Customer {
    id: string;
    name: string;
    phone: string;
    email?: string;
}

interface Service {
    id: string;
    name: string;
    price: number;
    durationMinutes: number;
    category?: string;
    isActive?: boolean;
}

interface Product {
    id: string;
    name: string;
    sellingPrice: number | null;
    unit: string;
    category?: string;
    stock?: number;
}

interface ProductItem {
    productId: string;
    quantity: number;
}

interface Staff {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
    isCashier?: boolean;
}

interface CouponResult {
    valid: boolean;
    message: string;
    coupon_id?: string;
    discount_type?: string;
    discount_value?: number;
    discount_amount?: number;
}

interface BillData {
    id: string;
    invoice_number: string;
    created_at: string;
    salon: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        gst_number?: string;
    };
    customer?: Customer;
    billed_by_name?: string;
    items: Array<{
        service_name?: string;
        item_name?: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        item_type?: 'service' | 'product';
        staff_name?: string;
    }>;
    subtotal: number;
    services_subtotal?: number;
    products_subtotal?: number;
    service_discount?: { type: 'percent' | 'fixed'; value: number; amount: number };
    product_discount?: { type: 'percent' | 'fixed'; value: number; amount: number };
    discount_percent?: number;
    discount_amount?: number;
    coupon_code?: string;
    tax_percent?: number;
    tax_amount?: number;
    final_amount: number;
    payment_method: string;
}

export default function BillingPage() {
    const { session } = useSession();
    const toast = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Bill state
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
    const [customerSearch, setCustomerSearch] = useState("");
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Staff state for billing attribution
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [selectedBiller, setSelectedBiller] = useState<string | null>(null);
    const [serviceStaffMap, setServiceStaffMap] = useState<Map<string, string>>(new Map()); // serviceId -> staffId

    // Separate discount state for services and products
    const [serviceDiscountType, setServiceDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [serviceDiscountValue, setServiceDiscountValue] = useState(0);
    const [productDiscountType, setProductDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [productDiscountValue, setProductDiscountValue] = useState(0);

    // Coupon state
    const [couponCode, setCouponCode] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
    const [couponError, setCouponError] = useState("");
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

    // Invoice state
    const [showInvoice, setShowInvoice] = useState(false);
    const [billData, setBillData] = useState<BillData | null>(null);
    const invoiceRef = useRef<HTMLDivElement>(null);

    // Settings
    const [gstPercentage, setGstPercentage] = useState(0);
    const [salonInfo, setSalonInfo] = useState<{
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        gst_number?: string;
    }>({ name: 'SalonX' });

    useEffect(() => {
        loadData();
    }, []);

    // Realtime sync - auto-refresh when data changes in other browsers
    const handleRealtimeUpdate = useCallback(() => {
        loadData();
    }, []);

    useRealtimeSync({ table: 'customers', onDataChange: handleRealtimeUpdate });
    useRealtimeSync({ table: 'services', onDataChange: handleRealtimeUpdate });

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Fetch customers
            const customersRes = await fetch('/api/customers');
            if (customersRes.ok) {
                const data = await customersRes.json();
                setCustomers(data.customers || []);
            }

            // Fetch services  
            const servicesRes = await fetch('/api/services');
            if (servicesRes.ok) {
                const data = await servicesRes.json();
                // Filter only active services
                const activeServices = (data.services || []).filter((s: Service) => s.isActive !== false);
                setServices(activeServices);
            }

            // Fetch staff for biller and service attribution
            const staffRes = await fetch('/api/staff');
            if (staffRes.ok) {
                const data = await staffRes.json();
                const activeStaff = (data.staff || []).filter((s: Staff) => s.isActive);
                setStaffList(activeStaff);
            }

            // Fetch products with inventory stock
            const inventoryRes = await fetch('/api/inventory');
            if (inventoryRes.ok) {
                const data = await inventoryRes.json();
                const inventoryItems = data.data || [];
                // Transform inventory to products with stock
                const productsWithStock: Product[] = inventoryItems
                    .filter((item: { product: { is_active?: boolean } }) => item.product?.is_active !== false)
                    .map((item: {
                        product_id: string;
                        quantity: number;
                        product: { name: string; selling_price: number | null; unit: string; category?: string }
                    }) => ({
                        id: item.product_id,
                        name: item.product?.name || 'Unknown',
                        sellingPrice: item.product?.selling_price || 0,
                        unit: item.product?.unit || 'pc',
                        category: item.product?.category,
                        stock: item.quantity || 0,
                    }));
                setProducts(productsWithStock);
            }

            // Fetch salon settings using session
            const salonRes = await fetch('/api/salon');
            if (salonRes.ok) {
                const data = await salonRes.json();
                if (data.salon) {
                    setSalonInfo({
                        name: data.salon.name || 'SalonX',
                        address: data.salon.address,
                        phone: data.salon.phone,
                        email: data.salon.email,
                        gst_number: data.salon.gst_number,
                    });
                    setGstPercentage(data.salon.gst_percentage || 0);
                }
            }
        } catch (err) {
            console.error('Failed to load data:', err);
            toast.error('Failed to load billing data');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );

    const toggleService = (id: string) => {
        setSelectedServices(prev => {
            if (prev.includes(id)) {
                // Remove service and its staff mapping
                setServiceStaffMap(prevMap => {
                    const newMap = new Map(prevMap);
                    newMap.delete(id);
                    return newMap;
                });
                return prev.filter(s => s !== id);
            } else {
                return [...prev, id];
            }
        });
        // Clear coupon when services change
        if (appliedCoupon) {
            setAppliedCoupon(null);
            setCouponCode("");
        }
    };

    // Update staff assignment for a service
    const updateServiceStaff = (serviceId: string, staffId: string) => {
        setServiceStaffMap(prev => {
            const newMap = new Map(prev);
            newMap.set(serviceId, staffId);
            return newMap;
        });
    };

    // Product selection helpers - grid-based toggle
    const toggleProduct = (productId: string) => {
        setSelectedProducts(prev => {
            const newMap = new Map(prev);
            if (newMap.has(productId)) {
                newMap.delete(productId);
            } else {
                newMap.set(productId, 1);
            }
            return newMap;
        });
        if (appliedCoupon) {
            setAppliedCoupon(null);
            setCouponCode("");
        }
    };

    const updateProductQuantity = (productId: string, quantity: number) => {
        setSelectedProducts(prev => {
            const newMap = new Map(prev);
            if (quantity <= 0) {
                newMap.delete(productId);
            } else {
                newMap.set(productId, quantity);
            }
            return newMap;
        });
    };

    // Calculate subtotals
    const servicesSubtotal = selectedServices.reduce((sum, id) => {
        const service = services.find(s => s.id === id);
        return sum + (service?.price || 0);
    }, 0);

    const productsSubtotal = Array.from(selectedProducts.entries()).reduce((sum, [productId, qty]) => {
        const product = products.find(p => p.id === productId);
        return sum + ((product?.sellingPrice || 0) * qty);
    }, 0);

    // Calculate separate discounts
    const serviceDiscountAmount = serviceDiscountType === 'percent'
        ? (servicesSubtotal * serviceDiscountValue) / 100
        : Math.min(serviceDiscountValue, servicesSubtotal);

    const productDiscountAmount = productDiscountType === 'percent'
        ? (productsSubtotal * productDiscountValue) / 100
        : Math.min(productDiscountValue, productsSubtotal);

    const servicesAfterDiscount = servicesSubtotal - serviceDiscountAmount;
    const productsAfterDiscount = productsSubtotal - productDiscountAmount;
    const subtotal = servicesAfterDiscount + productsAfterDiscount;
    const totalDiscount = serviceDiscountAmount + productDiscountAmount;

    const taxableAmount = subtotal;
    const gstAmount = (taxableAmount * gstPercentage) / 100;
    const total = taxableAmount + gstAmount;

    const validateCoupon = async () => {
        if (!couponCode.trim()) return;

        setIsValidatingCoupon(true);
        setCouponError("");

        try {
            const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: couponCode,
                    order_value: subtotal,
                }),
            });

            const data = await res.json();

            if (data.valid) {
                setAppliedCoupon(data);
                // Clear manual discounts when coupon is applied
                setServiceDiscountValue(0);
                setProductDiscountValue(0);
            } else {
                setCouponError(data.message || 'Invalid coupon');
                setAppliedCoupon(null);
            }
        } catch {
            setCouponError('Failed to validate coupon');
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const removeCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode("");
        setCouponError("");
    };

    const handlePayment = async () => {
        if (selectedServices.length === 0 && selectedProducts.size === 0) {
            toast.error('Please select at least one service or product');
            return;
        }

        // Validate biller selection
        if (!selectedBiller) {
            toast.error('Please select a biller/cashier');
            return;
        }

        // Validate staff assignment for services
        for (const serviceId of selectedServices) {
            if (!serviceStaffMap.has(serviceId)) {
                const service = services.find(s => s.id === serviceId);
                toast.error(`Please assign staff for "${service?.name || 'a service'}"`);
                return;
            }
        }

        // Validate stock for products
        for (const [productId, qty] of Array.from(selectedProducts.entries())) {
            const product = products.find(p => p.id === productId);
            if (product && product.stock !== undefined && product.stock < qty) {
                toast.error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
                return;
            }
        }

        setIsSaving(true);

        try {
            // Build service items with staff attribution
            const serviceItems = selectedServices.map(id => {
                const service = services.find(s => s.id === id);
                const staffId = serviceStaffMap.get(id);
                return {
                    item_type: 'service',
                    item_id: id,
                    item_name: service?.name || 'Unknown',
                    staff_id: staffId,
                    quantity: 1,
                    unit_price: service?.price || 0,
                };
            });

            // Build product items with staff attribution (biller as seller)
            const productItems = Array.from(selectedProducts.entries()).map(([productId, qty]) => {
                const product = products.find(p => p.id === productId);
                return {
                    item_type: 'product',
                    item_id: productId,
                    item_name: product?.name || 'Unknown',
                    staff_id: selectedBiller, // Products sold by biller
                    quantity: qty,
                    unit_price: product?.sellingPrice || 0,
                };
            });

            const allItems = [...serviceItems, ...productItems];

            // Complete billing with staff attribution
            const res = await fetch('/api/billing/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                },
                body: JSON.stringify({
                    customer_id: selectedCustomer?.id || null,
                    billed_by_staff_id: selectedBiller,
                    items: allItems,
                    subtotal: servicesSubtotal + productsSubtotal,
                    service_discount: { type: serviceDiscountType, value: serviceDiscountValue, amount: serviceDiscountAmount },
                    product_discount: { type: productDiscountType, value: productDiscountValue, amount: productDiscountAmount },
                    discount_amount: totalDiscount,
                    tax_percent: gstPercentage,
                    tax_amount: gstAmount,
                    final_amount: total,
                    payment_method: paymentMethod,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Deduct inventory for products if any
            if (productItems.length > 0) {
                const deductRes = await fetch('/api/billing/deduct', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        billing_id: data.bill.id,
                        items: productItems.map(p => ({
                            product_id: p.item_id,
                            quantity: p.quantity,
                            unit_price: p.unit_price,
                        })),
                    }),
                });

                const deductData = await deductRes.json();
                if (!deductRes.ok) {
                    console.error('Inventory deduction failed:', deductData);
                    toast.error(deductData.error || 'Failed to deduct inventory');
                    // Don't throw - bill is already created
                }
            }

            // Prepare invoice data with separate service/product breakdown + staff attribution
            const billerStaff = staffList.find(s => s.id === selectedBiller);
            const invoiceData: BillData = {
                id: data.bill.id,
                invoice_number: data.bill.invoice_number,
                created_at: data.bill.created_at,
                salon: salonInfo,
                customer: selectedCustomer || undefined,
                billed_by_name: billerStaff?.name,
                items: [
                    ...serviceItems.map(i => {
                        const performingStaff = staffList.find(s => s.id === i.staff_id);
                        return {
                            item_name: i.item_name,
                            quantity: i.quantity,
                            unit_price: i.unit_price,
                            total_price: i.unit_price * i.quantity,
                            item_type: 'service' as const,
                            staff_name: performingStaff?.name,
                        };
                    }),
                    ...productItems.map(i => ({
                        item_name: i.item_name,
                        quantity: i.quantity,
                        unit_price: i.unit_price,
                        total_price: i.unit_price * i.quantity,
                        item_type: 'product' as const,
                    })),
                ],
                subtotal: servicesSubtotal + productsSubtotal,
                services_subtotal: servicesSubtotal,
                products_subtotal: productsSubtotal,
                service_discount: { type: serviceDiscountType, value: serviceDiscountValue, amount: serviceDiscountAmount },
                product_discount: { type: productDiscountType, value: productDiscountValue, amount: productDiscountAmount },
                discount_amount: totalDiscount,
                tax_percent: gstPercentage,
                tax_amount: gstAmount,
                final_amount: total,
                payment_method: paymentMethod,
            };

            setBillData(invoiceData);
            setShowInvoice(true);
            toast.success('Payment completed!');
        } catch (err) {
            console.error('Payment error:', err);
            toast.error('Failed to complete payment. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadInvoice = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow || !invoiceRef.current) return;

        const invoiceHtml = invoiceRef.current.innerHTML;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice - ${billData?.invoice_number}</title>
                <style>
                    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; }
                    @media print {
                        body { padding: 0; }
                        @page { margin: 10mm; }
                    }
                </style>
            </head>
            <body>${invoiceHtml}</body>
            </html>
        `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const resetBilling = () => {
        setShowInvoice(false);
        setBillData(null);
        setSelectedCustomer(null);
        setSelectedServices([]);
        setSelectedProducts(new Map());
        setServiceDiscountType('percent');
        setServiceDiscountValue(0);
        setProductDiscountType('percent');
        setProductDiscountValue(0);
        setPaymentMethod('cash');
        setCustomerSearch("");
        setCouponCode("");
        setAppliedCoupon(null);
        // Reset staff selections
        setSelectedBiller(null);
        setServiceStaffMap(new Map());
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    // Invoice View
    if (showInvoice && billData) {
        return (
            <>
                <Header title="Payment Complete" subtitle="Invoice generated" />
                <div className={styles.invoiceContainer}>
                    <div className={styles.successHeader}>
                        <div className={styles.successIcon}>✓</div>
                        <h2>Payment Successful!</h2>
                        <p>₹{billData.final_amount.toLocaleString()} received via {billData.payment_method.toUpperCase()}</p>
                    </div>

                    <div className={styles.invoiceWrapper} ref={invoiceRef}>
                        <Invoice data={billData} />
                    </div>

                    <div className={styles.invoiceActions}>
                        <button className={styles.downloadBtn} onClick={handleDownloadInvoice}>
                            📥 Download Invoice
                        </button>
                        <button className={styles.newBillBtn} onClick={resetBilling}>
                            + New Bill
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Header title="Billing / POS" subtitle="Quick checkout" />

            <div className={styles.container}>
                {/* Left Panel: Services and Products Grids */}
                <div className={styles.leftPanel}>
                    {/* Services Grid */}
                    <div className={styles.servicesPanel}>
                        <h3 className={styles.panelTitle}>Select Services</h3>
                        {services.length === 0 ? (
                            <div className={styles.emptyServices}>
                                <p>No services available</p>
                            </div>
                        ) : (
                            <div className={styles.servicesGrid}>
                                {services.map(service => (
                                    <button
                                        key={service.id}
                                        className={`${styles.serviceCard} ${selectedServices.includes(service.id) ? styles.selected : ''}`}
                                        onClick={() => toggleService(service.id)}
                                    >
                                        <span className={styles.serviceName}>{service.name}</span>
                                        <span className={styles.servicePrice}>₹{service.price}</span>
                                        <span className={styles.serviceDuration}>{service.durationMinutes}m</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Products Grid */}
                    <div className={styles.productsPanel}>
                        <h3 className={styles.panelTitle}>Select Products</h3>
                        {products.length === 0 ? (
                            <div className={styles.emptyServices}>
                                <p>No products available</p>
                            </div>
                        ) : (
                            <div className={styles.servicesGrid}>
                                {products.map(product => {
                                    const isSelected = selectedProducts.has(product.id);
                                    const qty = selectedProducts.get(product.id) || 0;
                                    const isOutOfStock = (product.stock || 0) <= 0;
                                    return (
                                        <div
                                            key={product.id}
                                            className={`${styles.productCard} ${isSelected ? styles.selected : ''} ${isOutOfStock ? styles.outOfStock : ''}`}
                                        >
                                            <button
                                                className={styles.productCardBtn}
                                                onClick={() => !isOutOfStock && toggleProduct(product.id)}
                                                disabled={isOutOfStock}
                                            >
                                                <span className={styles.serviceName}>{product.name}</span>
                                                <span className={styles.servicePrice}>₹{product.sellingPrice}</span>
                                                <span className={styles.productStock}>{product.stock} in stock</span>
                                            </button>
                                            {isSelected && (
                                                <div className={styles.qtyControls}>
                                                    <button onClick={() => updateProductQuantity(product.id, qty - 1)}>−</button>
                                                    <span>{qty}</span>
                                                    <button
                                                        onClick={() => updateProductQuantity(product.id, qty + 1)}
                                                        disabled={qty >= (product.stock || 0)}
                                                    >+</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Bill Summary */}
                <div className={styles.billPanel}>
                    <h3 className={styles.panelTitle}>Bill Summary</h3>

                    {/* Customer Selection */}
                    <div className={styles.customerSection}>
                        {selectedCustomer ? (
                            <div className={styles.selectedCustomer}>
                                <div className={styles.customerAvatar}>{getInitials(selectedCustomer.name)}</div>
                                <div className={styles.customerInfo}>
                                    <span className={styles.customerName}>{selectedCustomer.name}</span>
                                    <span className={styles.customerPhone}>{selectedCustomer.phone}</span>
                                </div>
                                <button className={styles.clearCustomer} onClick={() => setSelectedCustomer(null)}>✕</button>
                            </div>
                        ) : (
                            <div className={styles.customerSearchWrapper}>
                                <input
                                    type="text"
                                    className={styles.customerSearch}
                                    placeholder="Search customer by name or phone..."
                                    value={customerSearch}
                                    onChange={e => {
                                        setCustomerSearch(e.target.value);
                                        setShowCustomerDropdown(true);
                                    }}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                                />
                                {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                                    <div className={styles.customerDropdown}>
                                        {filteredCustomers.slice(0, 5).map(c => (
                                            <button
                                                key={c.id}
                                                className={styles.customerOption}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setSelectedCustomer(c);
                                                    setCustomerSearch("");
                                                    setShowCustomerDropdown(false);
                                                }}
                                            >
                                                <span className={styles.customerAvatar}>{getInitials(c.name)}</span>
                                                <div>
                                                    <span className={styles.customerName}>{c.name}</span>
                                                    <span className={styles.customerPhone}>{c.phone}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Biller / Cashier Selection (REQUIRED) */}
                    <div className={styles.billerSection}>
                        <label className={styles.billerLabel}>
                            Billed By <span className={styles.required}>*</span>
                        </label>
                        <select
                            className={`${styles.billerSelect} ${!selectedBiller ? styles.invalid : ''}`}
                            value={selectedBiller || ''}
                            onChange={e => setSelectedBiller(e.target.value || null)}
                        >
                            <option value="">Select staff...</option>
                            {staffList.map(staff => (
                                <option key={staff.id} value={staff.id}>
                                    {staff.name} ({staff.role})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Services Section with Discount */}
                    <div className={styles.billSection}>
                        <div className={styles.billSectionHeader}>
                            <span className={styles.billSectionLabel}>Services</span>
                            <span className={styles.billSectionTotal}>₹{servicesSubtotal.toLocaleString()}</span>
                        </div>
                        {selectedServices.length === 0 ? (
                            <p className={styles.noItems}>No services selected</p>
                        ) : (
                            <>
                                {selectedServices.map(id => {
                                    const service = services.find(s => s.id === id);
                                    if (!service) return null;
                                    const assignedStaffId = serviceStaffMap.get(id);
                                    return (
                                        <div key={id} className={styles.billItemWithStaff}>
                                            <div className={styles.billItem}>
                                                <span>{service.name}</span>
                                                <span>₹{service.price}</span>
                                            </div>
                                            <select
                                                className={`${styles.staffSelect} ${!assignedStaffId ? styles.invalid : ''}`}
                                                value={assignedStaffId || ''}
                                                onChange={e => updateServiceStaff(id, e.target.value)}
                                            >
                                                <option value="">Assign staff...</option>
                                                {staffList.map(staff => (
                                                    <option key={staff.id} value={staff.id}>
                                                        {staff.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                                {/* Service Discount */}
                                <div className={styles.discountControl}>
                                    <span>Discount</span>
                                    <div className={styles.discountInputGroup}>
                                        <button
                                            className={`${styles.discountTypeBtn} ${serviceDiscountType === 'percent' ? styles.active : ''}`}
                                            onClick={() => setServiceDiscountType('percent')}
                                        >%</button>
                                        <button
                                            className={`${styles.discountTypeBtn} ${serviceDiscountType === 'fixed' ? styles.active : ''}`}
                                            onClick={() => setServiceDiscountType('fixed')}
                                        >₹</button>
                                        <input
                                            type="number"
                                            value={serviceDiscountValue || ''}
                                            onChange={e => setServiceDiscountValue(Math.max(0, Number(e.target.value)))}
                                            placeholder="0"
                                            min={0}
                                            max={serviceDiscountType === 'percent' ? 100 : servicesSubtotal}
                                        />
                                    </div>
                                    {serviceDiscountAmount > 0 && (
                                        <span className={styles.discountAmount}>-₹{serviceDiscountAmount.toLocaleString()}</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Products Section with Discount */}
                    <div className={styles.billSection}>
                        <div className={styles.billSectionHeader}>
                            <span className={styles.billSectionLabel}>Products</span>
                            <span className={styles.billSectionTotal}>₹{productsSubtotal.toLocaleString()}</span>
                        </div>
                        {selectedProducts.size === 0 ? (
                            <p className={styles.noItems}>No products selected</p>
                        ) : (
                            <>
                                {Array.from(selectedProducts.entries()).map(([productId, qty]) => {
                                    const product = products.find(p => p.id === productId);
                                    if (!product) return null;
                                    return (
                                        <div key={productId} className={styles.billItem}>
                                            <span>{product.name} × {qty}</span>
                                            <span>₹{((product.sellingPrice || 0) * qty).toLocaleString()}</span>
                                        </div>
                                    );
                                })}
                                {/* Product Discount */}
                                <div className={styles.discountControl}>
                                    <span>Discount</span>
                                    <div className={styles.discountInputGroup}>
                                        <button
                                            className={`${styles.discountTypeBtn} ${productDiscountType === 'percent' ? styles.active : ''}`}
                                            onClick={() => setProductDiscountType('percent')}
                                        >%</button>
                                        <button
                                            className={`${styles.discountTypeBtn} ${productDiscountType === 'fixed' ? styles.active : ''}`}
                                            onClick={() => setProductDiscountType('fixed')}
                                        >₹</button>
                                        <input
                                            type="number"
                                            value={productDiscountValue || ''}
                                            onChange={e => setProductDiscountValue(Math.max(0, Number(e.target.value)))}
                                            placeholder="0"
                                            min={0}
                                            max={productDiscountType === 'percent' ? 100 : productsSubtotal}
                                        />
                                    </div>
                                    {productDiscountAmount > 0 && (
                                        <span className={styles.discountAmount}>-₹{productDiscountAmount.toLocaleString()}</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Totals */}
                    <div className={styles.totals}>
                        <div className={styles.totalRow}>
                            <span>Services (after discount)</span>
                            <span>₹{servicesAfterDiscount.toLocaleString()}</span>
                        </div>
                        <div className={styles.totalRow}>
                            <span>Products (after discount)</span>
                            <span>₹{productsAfterDiscount.toLocaleString()}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className={styles.totalRow}>
                                <span>Total Discount</span>
                                <span className={styles.discount}>-₹{totalDiscount.toLocaleString()}</span>
                            </div>
                        )}
                        {gstPercentage > 0 && (
                            <div className={styles.totalRow}>
                                <span>GST ({gstPercentage}%)</span>
                                <span>₹{gstAmount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                            <span>Total</span>
                            <span>₹{total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className={styles.paymentMethods}>
                        <button
                            className={`${styles.paymentBtn} ${paymentMethod === 'cash' ? styles.active : ''}`}
                            onClick={() => setPaymentMethod('cash')}
                        >
                            💵 Cash
                        </button>
                        <button
                            className={`${styles.paymentBtn} ${paymentMethod === 'upi' ? styles.active : ''}`}
                            onClick={() => setPaymentMethod('upi')}
                        >
                            📱 UPI
                        </button>
                        <button
                            className={`${styles.paymentBtn} ${paymentMethod === 'card' ? styles.active : ''}`}
                            onClick={() => setPaymentMethod('card')}
                        >
                            💳 Card
                        </button>
                    </div>

                    {/* Pay Button */}
                    <button
                        className={styles.payBtn}
                        onClick={handlePayment}
                        disabled={(selectedServices.length === 0 && selectedProducts.size === 0) || isSaving}
                    >
                        {isSaving ? 'Processing...' : `Complete Payment - ₹${total.toLocaleString()}`}
                    </button>
                </div>
            </div>
        </>
    );
}
