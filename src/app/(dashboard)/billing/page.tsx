"use client";

import { useEffect, useState, useRef } from "react";
import Header from "@/components/layout/Header";
import Invoice from "@/components/Invoice";
import { useSession } from "@/lib/SessionContext";
import { useToast } from "@/components/ui/Toast";
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
    items: Array<{
        service_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
    }>;
    subtotal: number;
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
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Bill state
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
    const [customerSearch, setCustomerSearch] = useState("");
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

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
        setSelectedServices(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
        // Clear coupon when services change
        if (appliedCoupon) {
            setAppliedCoupon(null);
            setCouponCode("");
        }
    };

    const subtotal = selectedServices.reduce((sum, id) => {
        const service = services.find(s => s.id === id);
        return sum + (service?.price || 0);
    }, 0);

    // Calculate discount (coupon takes priority over manual)
    const couponDiscount = appliedCoupon?.discount_amount || 0;
    const manualDiscountAmount = appliedCoupon ? 0 : (subtotal * discount) / 100;
    const totalDiscount = couponDiscount || manualDiscountAmount;

    const taxableAmount = subtotal - totalDiscount;
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
                setDiscount(0); // Clear manual discount
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
        if (!selectedServices.length) return;

        setIsSaving(true);

        try {
            const items = selectedServices.map(id => {
                const service = services.find(s => s.id === id);
                return {
                    service_id: id,
                    service_name: service?.name || 'Unknown',
                    quantity: 1,
                    unit_price: service?.price || 0,
                };
            });

            const res = await fetch('/api/billing/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_id: selectedCustomer?.id || null,
                    items,
                    subtotal,
                    discount_percent: appliedCoupon ? null : discount,
                    discount_amount: totalDiscount,
                    coupon_id: appliedCoupon?.coupon_id || null,
                    coupon_code: appliedCoupon ? couponCode : null,
                    tax_percent: gstPercentage,
                    tax_amount: gstAmount,
                    final_amount: total,
                    payment_method: paymentMethod,
                }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            // Prepare invoice data
            const invoiceData: BillData = {
                id: data.bill.id,
                invoice_number: data.bill.invoice_number,
                created_at: data.bill.created_at,
                salon: salonInfo,
                customer: selectedCustomer || undefined,
                items: items.map(i => ({
                    ...i,
                    total_price: i.unit_price * i.quantity,
                })),
                subtotal,
                discount_percent: appliedCoupon ? undefined : discount,
                discount_amount: totalDiscount,
                coupon_code: appliedCoupon ? couponCode : undefined,
                tax_percent: gstPercentage,
                tax_amount: gstAmount,
                final_amount: total,
                payment_method: paymentMethod,
            };

            setBillData(invoiceData);
            setShowInvoice(true);
        } catch (err) {
            console.error('Payment error:', err);
            alert('Failed to complete payment. Please try again.');
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
        setDiscount(0);
        setPaymentMethod('cash');
        setCustomerSearch("");
        setCouponCode("");
        setAppliedCoupon(null);
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
                                />
                                {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                                    <div className={styles.customerDropdown}>
                                        {filteredCustomers.slice(0, 5).map(c => (
                                            <button
                                                key={c.id}
                                                className={styles.customerOption}
                                                onClick={() => {
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

                    {/* Selected Services */}
                    <div className={styles.billItems}>
                        {selectedServices.length === 0 ? (
                            <p className={styles.noItems}>No services selected</p>
                        ) : (
                            selectedServices.map(id => {
                                const service = services.find(s => s.id === id);
                                if (!service) return null;
                                return (
                                    <div key={id} className={styles.billItem}>
                                        <span>{service.name}</span>
                                        <span>₹{service.price}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Coupon Code */}
                    <div className={styles.couponSection}>
                        {appliedCoupon ? (
                            <div className={styles.appliedCoupon}>
                                <span>🎫 {couponCode.toUpperCase()}</span>
                                <span className={styles.couponDiscount}>-₹{couponDiscount.toLocaleString()}</span>
                                <button onClick={removeCoupon} className={styles.removeCoupon}>✕</button>
                            </div>
                        ) : (
                            <div className={styles.couponInput}>
                                <input
                                    type="text"
                                    placeholder="Enter coupon code"
                                    value={couponCode}
                                    onChange={e => {
                                        setCouponCode(e.target.value.toUpperCase());
                                        setCouponError("");
                                    }}
                                />
                                <button
                                    onClick={validateCoupon}
                                    disabled={!couponCode.trim() || isValidatingCoupon || selectedServices.length === 0}
                                >
                                    {isValidatingCoupon ? '...' : 'Apply'}
                                </button>
                            </div>
                        )}
                        {couponError && <p className={styles.couponError}>{couponError}</p>}
                    </div>

                    {/* Manual Discount (only if no coupon) */}
                    {!appliedCoupon && (
                        <div className={styles.discountRow}>
                            <label>Discount (%)</label>
                            <input
                                type="number"
                                value={discount}
                                onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                                min={0}
                                max={100}
                            />
                        </div>
                    )}

                    {/* Totals */}
                    <div className={styles.totals}>
                        <div className={styles.totalRow}>
                            <span>Subtotal</span>
                            <span>₹{subtotal.toLocaleString()}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className={styles.totalRow}>
                                <span>Discount {appliedCoupon ? `(${couponCode})` : `(${discount}%)`}</span>
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
                        disabled={selectedServices.length === 0 || isSaving}
                    >
                        {isSaving ? 'Processing...' : `Complete Payment - ₹${total.toLocaleString()}`}
                    </button>
                </div>
            </div>
        </>
    );
}
