"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Customer, Service, Bill } from "@/lib/database";
import styles from "./page.module.css";

export default function BillingPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);

    // Bill state
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [discount, setDiscount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
    const [customerSearch, setCustomerSearch] = useState("");

    useEffect(() => {
        if (!db.auth.isOnboardingComplete()) {
            router.push("/onboarding");
            return;
        }

        setCustomers(db.customers.getAll());
        setServices(db.services.getAll().filter(s => s.isActive));
        setIsLoading(false);
    }, [router]);

    const settings = db.settings.get();
    const gstPercentage = settings?.gstPercentage || 0;

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );

    const toggleService = (id: string) => {
        setSelectedServices(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const subtotal = selectedServices.reduce((sum, id) => {
        const service = services.find(s => s.id === id);
        return sum + (service?.price || 0);
    }, 0);

    const discountAmount = (subtotal * discount) / 100;
    const taxableAmount = subtotal - discountAmount;
    const gstAmount = (taxableAmount * gstPercentage) / 100;
    const total = taxableAmount + gstAmount;

    const handlePayment = () => {
        if (!selectedCustomerId || selectedServices.length === 0) return;

        const salon = db.salon.get();
        if (!salon) return;

        // Create bill
        db.bills.create({
            salonId: salon.id,
            appointmentId: "",
            customerId: selectedCustomerId,
            totalAmount: subtotal,
            discount: discountAmount,
            taxAmount: gstAmount,
            finalAmount: total,
            paymentStatus: "paid",
            paymentMethod,
        });

        // Show success
        setShowSuccess(true);

        // Reset after delay
        setTimeout(() => {
            setShowSuccess(false);
            setSelectedCustomerId("");
            setSelectedServices([]);
            setDiscount(0);
            setPaymentMethod('cash');
            setCustomerSearch("");
        }, 2000);
    };

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    if (showSuccess) {
        return (
            <div className={styles.successScreen}>
                <div className={styles.successIcon}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </div>
                <h2>Payment Successful!</h2>
                <p>₹{total.toLocaleString()} received via {paymentMethod.toUpperCase()}</p>
            </div>
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
                            <button onClick={() => router.push('/services')}>Add Services</button>
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
                        <input
                            type="text"
                            className={styles.customerSearch}
                            placeholder="Search customer by name or phone..."
                            value={customerSearch}
                            onChange={e => setCustomerSearch(e.target.value)}
                        />
                        {customerSearch && filteredCustomers.length > 0 && (
                            <div className={styles.customerDropdown}>
                                {filteredCustomers.slice(0, 5).map(c => (
                                    <button
                                        key={c.id}
                                        className={styles.customerOption}
                                        onClick={() => {
                                            setSelectedCustomerId(c.id);
                                            setCustomerSearch(c.name);
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

                    {/* Discount */}
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

                    {/* Totals */}
                    <div className={styles.totals}>
                        <div className={styles.totalRow}>
                            <span>Subtotal</span>
                            <span>₹{subtotal.toLocaleString()}</span>
                        </div>
                        {discount > 0 && (
                            <div className={styles.totalRow}>
                                <span>Discount ({discount}%)</span>
                                <span className={styles.discount}>-₹{discountAmount.toLocaleString()}</span>
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
                        disabled={!selectedCustomerId || selectedServices.length === 0}
                    >
                        Complete Payment - ₹{total.toLocaleString()}
                    </button>
                </div>
            </div>
        </>
    );
}
