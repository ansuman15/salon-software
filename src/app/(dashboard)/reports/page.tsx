"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from 'next/dynamic';
import Header from "@/components/layout/Header";
import { useMultiRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

// Dynamic import for Recharts (client-side only)
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });

interface ChartData {
    date?: string;
    month?: string;
    revenue: number;
    bills: number;
}

interface StaffPerformance {
    name: string;
    services: number;
    revenue: number;
}

interface Bill {
    id: string;
    invoice_number: string;
    created_at: string;
    final_amount: number;
    payment_method: string;
    items_count: number;
    customer?: { name: string; phone?: string };
}

interface TopService {
    name: string;
    count: number;
    revenue: number;
}

export default function ReportsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'staff'>('overview');
    const [chartPeriod, setChartPeriod] = useState<'daily' | 'monthly'>('daily');
    const [isDownloading, setIsDownloading] = useState(false);

    // Revenue data
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [weekRevenue, setWeekRevenue] = useState(0);
    const [monthRevenue, setMonthRevenue] = useState(0);

    // Chart data
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [chartLoading, setChartLoading] = useState(false);

    // Staff performance
    const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
    const [topServices, setTopServices] = useState<TopService[]>([]);

    // Bills history
    const [bills, setBills] = useState<Bill[]>([]);
    const [billsPage, setBillsPage] = useState(1);
    const [billsTotal, setBillsTotal] = useState(0);
    const [billsSearch, setBillsSearch] = useState('');
    const [billsLoading, setBillsLoading] = useState(false);

    // Load revenue summary
    const loadRevenue = useCallback(async () => {
        try {
            const res = await fetch('/api/reports/revenue');
            if (res.ok) {
                const data = await res.json();
                setTodayRevenue(data.today || 0);
                setWeekRevenue(data.week || 0);
                setMonthRevenue(data.month || 0);
            }
        } catch (error) {
            console.error('Failed to load revenue:', error);
        }
    }, []);

    // Load chart data
    const loadChart = useCallback(async () => {
        setChartLoading(true);
        try {
            const res = await fetch(`/api/reports/chart?period=${chartPeriod}&days=30`);
            if (res.ok) {
                const data = await res.json();
                setChartData(data.data || []);
            }
        } catch (error) {
            console.error('Failed to load chart:', error);
        } finally {
            setChartLoading(false);
        }
    }, [chartPeriod]);

    // Load performance data
    const loadPerformance = useCallback(async () => {
        try {
            const res = await fetch('/api/reports/performance');
            if (res.ok) {
                const data = await res.json();
                setStaffPerformance(data.staffPerformance || []);
                setTopServices(data.topServices || []);
            }
        } catch (error) {
            console.error('Failed to load performance:', error);
        }
    }, []);

    // Load bills history
    const loadBills = useCallback(async (page = 1, search = '') => {
        setBillsLoading(true);
        try {
            let url = `/api/reports/bills?page=${page}&limit=10`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setBills(data.bills || []);
                setBillsTotal(data.total || 0);
                setBillsPage(page);
            }
        } catch (error) {
            console.error('Failed to load bills:', error);
        } finally {
            setBillsLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            await Promise.all([loadRevenue(), loadChart(), loadPerformance(), loadBills()]);
            setIsLoading(false);
        };
        loadAll();
    }, [loadRevenue, loadChart, loadPerformance, loadBills]);

    // Reload chart when period changes
    useEffect(() => {
        loadChart();
    }, [chartPeriod, loadChart]);

    // Realtime sync
    useMultiRealtimeSync(
        ['bills', 'staff'],
        () => {
            loadRevenue();
            loadPerformance();
            if (activeTab === 'bills') loadBills(billsPage, billsSearch);
        },
        true
    );

    // Download report
    const handleDownload = async (period: 'week' | 'month') => {
        setIsDownloading(true);
        try {
            const res = await fetch(`/api/reports/download?period=${period}`);

            if (!res.ok) {
                // Try to parse error message from response
                const contentType = res.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const errorData = await res.json();
                    console.error('[Report Download] API Error:', errorData);
                    alert(`Failed to generate report: ${errorData.error || 'Unknown error'}`);
                } else {
                    console.error('[Report Download] HTTP Error:', res.status, res.statusText);
                    alert(`Failed to generate report: ${res.statusText || 'Server error'}`);
                }
                return;
            }

            const blob = await res.blob();

            // Verify we got a PDF
            if (blob.type !== 'application/pdf' && blob.size < 100) {
                console.error('[Report Download] Invalid response:', blob.type, blob.size);
                alert('Failed to generate report: Invalid response from server');
                return;
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_${period === 'week' ? 'Weekly' : 'Monthly'}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[Report Download] Error:', error);
            alert(`Download failed: ${error instanceof Error ? error.message : 'Network error'}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount.toLocaleString('en-IN')}`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatChartLabel = (item: ChartData) => {
        if (item.date) {
            const d = new Date(item.date);
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        }
        if (item.month) {
            const [year, month] = item.month.split('-');
            return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-IN', { month: 'short' });
        }
        return '';
    };

    if (isLoading) {
        return (
            <>
                <Header title="Reports & Analytics" subtitle="Business insights" />
                <div className={styles.loading}><div className={styles.spinner}></div></div>
            </>
        );
    }

    return (
        <>
            <Header title="Reports & Analytics" subtitle="Business insights" />

            <div className={styles.container}>
                {/* Top Actions */}
                <div className={styles.topBar}>
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            📊 Overview
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'bills' ? styles.active : ''}`}
                            onClick={() => { setActiveTab('bills'); loadBills(); }}
                        >
                            🧾 Bills History
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'staff' ? styles.active : ''}`}
                            onClick={() => setActiveTab('staff')}
                        >
                            👥 Staff Performance
                        </button>
                    </div>
                    <div className={styles.downloadBtns}>
                        <button
                            className={styles.downloadBtn}
                            onClick={() => handleDownload('week')}
                            disabled={isDownloading}
                        >
                            📥 Weekly Report
                        </button>
                        <button
                            className={styles.downloadBtn}
                            onClick={() => handleDownload('month')}
                            disabled={isDownloading}
                        >
                            📥 Monthly Report
                        </button>
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <>
                        {/* Revenue Cards */}
                        <div className={styles.revenueCards}>
                            <div className={`${styles.revenueCard} ${styles.today}`}>
                                <div className={styles.cardIcon}>📅</div>
                                <div className={styles.cardInfo}>
                                    <span className={styles.cardLabel}>Today's Revenue</span>
                                    <span className={styles.cardValue}>{formatCurrency(todayRevenue)}</span>
                                </div>
                            </div>
                            <div className={`${styles.revenueCard} ${styles.week}`}>
                                <div className={styles.cardIcon}>📆</div>
                                <div className={styles.cardInfo}>
                                    <span className={styles.cardLabel}>This Week</span>
                                    <span className={styles.cardValue}>{formatCurrency(weekRevenue)}</span>
                                </div>
                            </div>
                            <div className={`${styles.revenueCard} ${styles.month}`}>
                                <div className={styles.cardIcon}>🗓️</div>
                                <div className={styles.cardInfo}>
                                    <span className={styles.cardLabel}>This Month</span>
                                    <span className={styles.cardValue}>{formatCurrency(monthRevenue)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Revenue Chart */}
                        <div className={styles.chartSection}>
                            <div className={styles.chartHeader}>
                                <h3>Revenue Trend</h3>
                                <div className={styles.chartToggle}>
                                    <button
                                        className={chartPeriod === 'daily' ? styles.active : ''}
                                        onClick={() => setChartPeriod('daily')}
                                    >
                                        Daily
                                    </button>
                                    <button
                                        className={chartPeriod === 'monthly' ? styles.active : ''}
                                        onClick={() => setChartPeriod('monthly')}
                                    >
                                        Monthly
                                    </button>
                                </div>
                            </div>
                            <div className={styles.chartContainer}>
                                {chartLoading ? (
                                    <div className={styles.chartLoading}>Loading chart...</div>
                                ) : chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey={chartPeriod === 'daily' ? 'date' : 'month'}
                                                tickFormatter={(val) => formatChartLabel({ [chartPeriod === 'daily' ? 'date' : 'month']: val, revenue: 0, bills: 0 })}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis
                                                tickFormatter={(val) => formatCurrency(val)}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <Tooltip
                                                formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                                                labelFormatter={(label) => formatChartLabel({ [chartPeriod === 'daily' ? 'date' : 'month']: label as string, revenue: 0, bills: 0 })}
                                            />
                                            <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className={styles.noData}>No revenue data available</div>
                                )}
                            </div>
                        </div>

                        {/* Top Services */}
                        <div className={styles.section}>
                            <h3>🔥 Top Services</h3>
                            {topServices.length > 0 ? (
                                <div className={styles.topServicesList}>
                                    {topServices.slice(0, 5).map((service, idx) => (
                                        <div key={idx} className={styles.topServiceItem}>
                                            <span className={styles.rank}>#{idx + 1}</span>
                                            <span className={styles.serviceName}>{service.name}</span>
                                            <span className={styles.serviceCount}>{service.count} times</span>
                                            <span className={styles.serviceRevenue}>{formatCurrency(service.revenue)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.noData}>No service data yet</p>
                            )}
                        </div>
                    </>
                )}

                {/* Bills History Tab */}
                {activeTab === 'bills' && (
                    <div className={styles.billsSection}>
                        <div className={styles.billsHeader}>
                            <input
                                type="text"
                                placeholder="Search by invoice number..."
                                value={billsSearch}
                                onChange={(e) => setBillsSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && loadBills(1, billsSearch)}
                                className={styles.searchInput}
                            />
                            <button
                                className={styles.searchBtn}
                                onClick={() => loadBills(1, billsSearch)}
                            >
                                🔍 Search
                            </button>
                        </div>

                        {billsLoading ? (
                            <div className={styles.loading}><div className={styles.spinner}></div></div>
                        ) : bills.length > 0 ? (
                            <>
                                <table className={styles.billsTable}>
                                    <thead>
                                        <tr>
                                            <th>Invoice #</th>
                                            <th>Customer</th>
                                            <th>Date</th>
                                            <th>Items</th>
                                            <th>Amount</th>
                                            <th>Payment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bills.map(bill => (
                                            <tr key={bill.id}>
                                                <td className={styles.invoiceNum}>{bill.invoice_number}</td>
                                                <td>{bill.customer?.name || 'Walk-in'}</td>
                                                <td>{formatDate(bill.created_at)}</td>
                                                <td>{bill.items_count}</td>
                                                <td className={styles.amount}>₹{bill.final_amount.toLocaleString('en-IN')}</td>
                                                <td>
                                                    <span className={`${styles.paymentBadge} ${styles[bill.payment_method]}`}>
                                                        {bill.payment_method.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className={styles.pagination}>
                                    <span>Showing {bills.length} of {billsTotal} bills</span>
                                    <div className={styles.pageButtons}>
                                        <button
                                            disabled={billsPage <= 1}
                                            onClick={() => loadBills(billsPage - 1, billsSearch)}
                                        >
                                            ← Previous
                                        </button>
                                        <span>Page {billsPage}</span>
                                        <button
                                            disabled={bills.length < 10}
                                            onClick={() => loadBills(billsPage + 1, billsSearch)}
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No bills found</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Staff Performance Tab */}
                {activeTab === 'staff' && (
                    <div className={styles.staffSection}>
                        <h3>👥 Staff Performance</h3>
                        {staffPerformance.length > 0 ? (
                            <table className={styles.staffTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Staff Name</th>
                                        <th>Services Done</th>
                                        <th>Revenue Generated</th>
                                        <th>Avg per Service</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffPerformance.map((staff, idx) => (
                                        <tr key={idx}>
                                            <td className={styles.rank}>#{idx + 1}</td>
                                            <td className={styles.staffName}>{staff.name}</td>
                                            <td>{staff.services}</td>
                                            <td className={styles.revenue}>{formatCurrency(staff.revenue)}</td>
                                            <td>{staff.services > 0 ? formatCurrency(staff.revenue / staff.services) : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No staff performance data yet</p>
                                <span>Complete some bills to see staff metrics</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
