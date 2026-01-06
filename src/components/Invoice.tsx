"use client";

import React, { forwardRef } from 'react';

interface InvoiceItem {
    service_name?: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    item_type?: 'service' | 'product';
    staff_name?: string; // Name of staff who performed service
    performing_staff?: { id: string; name: string }; // From API join
}

interface DiscountInfo {
    type: 'percent' | 'fixed';
    value: number;
    amount: number;
}

interface InvoiceData {
    invoice_number: string;
    created_at: string;
    salon: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        gst_number?: string;
    };
    customer?: {
        name: string;
        phone?: string;
        email?: string;
    };
    // Staff Attribution
    billed_by?: { id: string; name: string; role?: string };
    billed_by_name?: string;
    items: InvoiceItem[];
    subtotal: number;
    services_subtotal?: number;
    products_subtotal?: number;
    service_discount?: DiscountInfo;
    product_discount?: DiscountInfo;
    discount_percent?: number;
    discount_amount?: number;
    coupon_code?: string;
    tax_percent?: number;
    tax_amount?: number;
    final_amount: number;
    payment_method: string;
}

interface InvoiceProps {
    data: InvoiceData;
}

const Invoice = forwardRef<HTMLDivElement, InvoiceProps>(({ data }, ref) => {
    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Separate items by type
    const serviceItems = data.items.filter(i => i.item_type === 'service' || !i.item_type);
    const productItems = data.items.filter(i => i.item_type === 'product');

    const formatDiscount = (discount: DiscountInfo) => {
        if (discount.type === 'percent') {
            return `${discount.value}%`;
        }
        return `₹${discount.value}`;
    };

    return (
        <div ref={ref} style={styles.invoice}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.salonInfo}>
                    <h1 style={styles.salonName}>{data.salon.name}</h1>
                    {data.salon.phone && <p style={styles.salonDetail}>📞 {data.salon.phone}</p>}
                    {data.salon.email && <p style={styles.salonDetail}>✉️ {data.salon.email}</p>}
                    {data.salon.address && <p style={styles.salonDetail}>📍 {data.salon.address}</p>}
                    {data.salon.gst_number && <p style={styles.gst}>GSTIN: {data.salon.gst_number}</p>}
                </div>
                <div style={styles.invoiceInfo}>
                    <h2 style={styles.invoiceTitle}>INVOICE</h2>
                    <p style={styles.invoiceNumber}>{data.invoice_number}</p>
                    <p style={styles.invoiceDate}>{formatDate(data.created_at)}</p>
                </div>
            </div>

            {/* Divider */}
            <div style={styles.divider}></div>

            {/* Customer Info */}
            {data.customer && (
                <div style={styles.customerSection}>
                    <h3 style={styles.sectionTitle}>Bill To:</h3>
                    <p style={styles.customerName}>{data.customer.name}</p>
                    {data.customer.phone && <p style={styles.customerDetail}>{data.customer.phone}</p>}
                    {data.customer.email && <p style={styles.customerDetail}>{data.customer.email}</p>}
                </div>
            )}

            {/* Services Section */}
            {serviceItems.length > 0 && (
                <>
                    <h3 style={styles.sectionLabel}>SERVICES</h3>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={{ ...styles.th, textAlign: 'left' as const }}>Service</th>
                                <th style={styles.th}>By</th>
                                <th style={styles.th}>Price</th>
                                <th style={{ ...styles.th, textAlign: 'right' as const }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {serviceItems.map((item, index) => {
                                const staffName = item.staff_name || item.performing_staff?.name || '-';
                                const itemName = item.item_name || item.service_name || 'Service';
                                return (
                                    <tr key={index} style={styles.tableRow}>
                                        <td style={styles.td}>{itemName}</td>
                                        <td style={{ ...styles.td, textAlign: 'center' as const, fontSize: '11px', color: '#6b7280' }}>{staffName}</td>
                                        <td style={{ ...styles.td, textAlign: 'center' as const }}>₹{item.unit_price}</td>
                                        <td style={{ ...styles.td, textAlign: 'right' as const }}>₹{item.total_price}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {data.service_discount && data.service_discount.amount > 0 && (
                        <div style={styles.discountRow}>
                            <span>Service Discount ({formatDiscount(data.service_discount)})</span>
                            <span style={{ color: '#22c55e' }}>-₹{data.service_discount.amount.toLocaleString()}</span>
                        </div>
                    )}
                </>
            )}

            {/* Products Section */}
            {productItems.length > 0 && (
                <>
                    <h3 style={styles.sectionLabel}>PRODUCTS</h3>
                    <table style={styles.table}>
                        <thead>
                            <tr style={styles.tableHeader}>
                                <th style={{ ...styles.th, textAlign: 'left' as const }}>Product</th>
                                <th style={styles.th}>Qty</th>
                                <th style={styles.th}>Price</th>
                                <th style={{ ...styles.th, textAlign: 'right' as const }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productItems.map((item, index) => {
                                const itemName = item.item_name || item.service_name || 'Product';
                                return (
                                    <tr key={index} style={styles.tableRow}>
                                        <td style={styles.td}>{itemName}</td>
                                        <td style={{ ...styles.td, textAlign: 'center' as const }}>{item.quantity}</td>
                                        <td style={{ ...styles.td, textAlign: 'center' as const }}>₹{item.unit_price}</td>
                                        <td style={{ ...styles.td, textAlign: 'right' as const }}>₹{item.total_price}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {data.product_discount && data.product_discount.amount > 0 && (
                        <div style={styles.discountRow}>
                            <span>Product Discount ({formatDiscount(data.product_discount)})</span>
                            <span style={{ color: '#22c55e' }}>-₹{data.product_discount.amount.toLocaleString()}</span>
                        </div>
                    )}
                </>
            )}

            {/* Totals */}
            <div style={styles.totalsSection}>
                <div style={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>₹{data.subtotal.toLocaleString()}</span>
                </div>
                {data.discount_amount && data.discount_amount > 0 && (
                    <div style={styles.totalRow}>
                        <span>
                            Total Discount
                            {data.coupon_code && ` (${data.coupon_code})`}
                        </span>
                        <span style={{ color: '#22c55e' }}>-₹{data.discount_amount.toLocaleString()}</span>
                    </div>
                )}
                {data.tax_amount && data.tax_amount > 0 && (
                    <div style={styles.totalRow}>
                        <span>GST ({data.tax_percent}%)</span>
                        <span>₹{data.tax_amount.toLocaleString()}</span>
                    </div>
                )}
                <div style={styles.grandTotal}>
                    <span>Total Amount</span>
                    <span>₹{data.final_amount.toLocaleString()}</span>
                </div>
            </div>

            {/* Payment Info */}
            <div style={styles.paymentInfo}>
                <div>
                    <p style={{ margin: 0 }}>Payment: <strong>{data.payment_method.toUpperCase()}</strong></p>
                    {(data.billed_by || data.billed_by_name) && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                            Billed by: {data.billed_by?.name || data.billed_by_name}
                        </p>
                    )}
                </div>
                <p style={styles.paidBadge}>✓ PAID</p>
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                <p>Thank you for your visit!</p>
                <p style={styles.footerNote}>This is a computer-generated invoice.</p>
            </div>
        </div>
    );
});

Invoice.displayName = 'Invoice';

const styles: { [key: string]: React.CSSProperties } = {
    invoice: {
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '24px',
        backgroundColor: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        color: '#1f2937',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '16px',
    },
    salonInfo: {},
    salonName: {
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '0 0 8px 0',
        color: '#111827',
    },
    salonDetail: {
        margin: '2px 0',
        fontSize: '12px',
        color: '#6b7280',
    },
    gst: {
        margin: '4px 0 0 0',
        fontSize: '11px',
        color: '#9ca3af',
    },
    invoiceInfo: {
        textAlign: 'right' as const,
    },
    invoiceTitle: {
        fontSize: '20px',
        fontWeight: 'bold',
        margin: '0',
        color: '#111827',
    },
    invoiceNumber: {
        fontSize: '12px',
        color: '#6b7280',
        margin: '4px 0',
    },
    invoiceDate: {
        fontSize: '12px',
        color: '#6b7280',
    },
    divider: {
        height: '2px',
        backgroundColor: '#e5e7eb',
        margin: '16px 0',
    },
    customerSection: {
        marginBottom: '16px',
    },
    sectionTitle: {
        fontSize: '12px',
        color: '#9ca3af',
        margin: '0 0 4px 0',
        textTransform: 'uppercase' as const,
    },
    customerName: {
        fontWeight: '600',
        margin: '0',
    },
    customerDetail: {
        fontSize: '12px',
        color: '#6b7280',
        margin: '2px 0',
    },
    sectionLabel: {
        fontSize: '12px',
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase' as const,
        margin: '16px 0 8px 0',
        letterSpacing: '0.5px',
    },
    discountRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        fontSize: '12px',
        color: '#6b7280',
        borderBottom: '1px dashed #e5e7eb',
        marginBottom: '8px',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse' as const,
        marginBottom: '16px',
    },
    tableHeader: {
        backgroundColor: '#f3f4f6',
    },
    th: {
        padding: '8px 12px',
        fontSize: '11px',
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase' as const,
        textAlign: 'center' as const,
    },
    tableRow: {
        borderBottom: '1px solid #e5e7eb',
    },
    td: {
        padding: '10px 12px',
    },
    totalsSection: {
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid #e5e7eb',
    },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        fontSize: '13px',
    },
    grandTotal: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 0',
        marginTop: '8px',
        borderTop: '2px solid #111827',
        fontSize: '18px',
        fontWeight: 'bold',
    },
    paymentInfo: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
    },
    paidBadge: {
        color: '#22c55e',
        fontWeight: 'bold',
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center' as const,
        color: '#6b7280',
    },
    footerNote: {
        fontSize: '10px',
        marginTop: '8px',
    },
};

export default Invoice;
