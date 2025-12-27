"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useMultiRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

interface Customer {
    id: string;
    name: string;
    createdAt: string;
}

interface Appointment {
    id: string;
    staffId: string;
    serviceIds: string[];
    status: string;
}

interface Service {
    id: string;
    name: string;
    price: number;
}

interface Staff {
    id: string;
    name: string;
}

interface ReportData {
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
    totalCustomers: number;
    newCustomersThisMonth: number;
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    topServices: { name: string; count: number; revenue: number }[];
    staffPerformance: { name: string; appointments: number; revenue: number }[];
}

export default function ReportsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<ReportData>({
        todayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        totalCustomers: 0,
        newCustomersThisMonth: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        topServices: [],
        staffPerformance: [],
    });

    const loadReports = useCallback(async () => {
        try {
            // Fetch all data in parallel
            const [customersRes, appointmentsRes, servicesRes, staffRes, revenueRes] = await Promise.all([
                fetch('/api/customers'),
                fetch('/api/appointments'),
                fetch('/api/services'),
                fetch('/api/staff'),
                fetch('/api/reports/revenue').catch(() => null),
            ]);

            let customers: Customer[] = [];
            let appointments: Appointment[] = [];
            let services: Service[] = [];
            let staff: Staff[] = [];

            if (customersRes.ok) {
                const d = await customersRes.json();
                customers = d.customers || [];
            }
            if (appointmentsRes.ok) {
                const d = await appointmentsRes.json();
                appointments = d.appointments || [];
            }
            if (servicesRes.ok) {
                const d = await servicesRes.json();
                services = d.services || [];
            }
            if (staffRes.ok) {
                const d = await staffRes.json();
                staff = d.staff || [];
            }

            // Get revenue from API
            let todayRevenue = 0, weekRevenue = 0, monthRevenue = 0;
            if (revenueRes && revenueRes.ok) {
                const revenueData = await revenueRes.json();
                todayRevenue = revenueData.today || 0;
                weekRevenue = revenueData.week || 0;
                monthRevenue = revenueData.month || 0;
            }

            // Calculate new customers this month
            const monthAgo = new Date();
            monthAgo.setDate(monthAgo.getDate() - 30);
            const newCustomersThisMonth = customers.filter(c => new Date(c.createdAt) >= monthAgo).length;

            // Calculate top services
            const serviceCount: Record<string, { count: number; revenue: number }> = {};
            appointments.forEach(apt => {
                apt.serviceIds.forEach(id => {
                    if (!serviceCount[id]) serviceCount[id] = { count: 0, revenue: 0 };
                    serviceCount[id].count++;
                    const service = services.find(s => s.id === id);
                    if (service) serviceCount[id].revenue += service.price;
                });
            });

            const topServices = Object.entries(serviceCount)
                .map(([id, data]) => ({
                    name: services.find(s => s.id === id)?.name || 'Unknown',
                    count: data.count,
                    revenue: data.revenue,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // Calculate staff performance
            const staffStats: Record<string, { appointments: number; revenue: number }> = {};
            appointments.forEach(apt => {
                if (!staffStats[apt.staffId]) staffStats[apt.staffId] = { appointments: 0, revenue: 0 };
                staffStats[apt.staffId].appointments++;
            });

            const staffPerformance = Object.entries(staffStats)
                .map(([id, stats]) => ({
                    name: staff.find(s => s.id === id)?.name || 'Unknown',
                    appointments: stats.appointments,
                    revenue: stats.revenue,
                }))
                .sort((a, b) => b.appointments - a.appointments)
                .slice(0, 5);

            setData({
                todayRevenue,
                weekRevenue,
                monthRevenue,
                totalCustomers: customers.length,
                newCustomersThisMonth,
                totalAppointments: appointments.length,
                completedAppointments: appointments.filter(a => a.status === 'completed').length,
                cancelledAppointments: appointments.filter(a => a.status === 'cancelled').length,
                topServices,
                staffPerformance,
            });

        } catch (error) {
            console.error('Failed to load reports:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    // Realtime sync - auto-refresh when data changes
    useMultiRealtimeSync(
        ['customers', 'appointments', 'services', 'staff', 'bills'],
        loadReports,
        true
    );

    const formatCurrency = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount.toLocaleString()}`;
    };

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Reports & Insights" subtitle="Your salon performance overview" />

            <div className={styles.container}>
                {/* Revenue Cards */}
                <div className={styles.revenueGrid}>
                    <div className={styles.revenueCard}>
                        <span className={styles.revenueLabel}>Today's Revenue</span>
                        <span className={styles.revenueValue}>{formatCurrency(data.todayRevenue)}</span>
                    </div>
                    <div className={styles.revenueCard}>
                        <span className={styles.revenueLabel}>This Week</span>
                        <span className={styles.revenueValue}>{formatCurrency(data.weekRevenue)}</span>
                    </div>
                    <div className={styles.revenueCard}>
                        <span className={styles.revenueLabel}>This Month</span>
                        <span className={styles.revenueValue}>{formatCurrency(data.monthRevenue)}</span>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{data.totalCustomers}</span>
                        <span className={styles.statLabel}>Total Customers</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>+{data.newCustomersThisMonth}</span>
                        <span className={styles.statLabel}>New This Month</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{data.completedAppointments}</span>
                        <span className={styles.statLabel}>Completed Appointments</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statValue}>{data.cancelledAppointments}</span>
                        <span className={styles.statLabel}>Cancelled</span>
                    </div>
                </div>

                {/* Charts Row */}
                <div className={styles.chartsRow}>
                    {/* Top Services */}
                    <div className={styles.chartCard}>
                        <h3>Top Services</h3>
                        {data.topServices.length === 0 ? (
                            <p className={styles.emptyChart}>No data yet</p>
                        ) : (
                            <div className={styles.chartList}>
                                {data.topServices.map((service, idx) => (
                                    <div key={idx} className={styles.chartItem}>
                                        <div className={styles.chartRank}>{idx + 1}</div>
                                        <div className={styles.chartInfo}>
                                            <span className={styles.chartName}>{service.name}</span>
                                            <span className={styles.chartMeta}>{service.count} bookings</span>
                                        </div>
                                        <span className={styles.chartValue}>{formatCurrency(service.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Staff Performance */}
                    <div className={styles.chartCard}>
                        <h3>Staff Performance</h3>
                        {data.staffPerformance.length === 0 ? (
                            <p className={styles.emptyChart}>No data yet</p>
                        ) : (
                            <div className={styles.chartList}>
                                {data.staffPerformance.map((staffMember, idx) => (
                                    <div key={idx} className={styles.chartItem}>
                                        <div className={styles.chartRank}>{idx + 1}</div>
                                        <div className={styles.chartInfo}>
                                            <span className={styles.chartName}>{staffMember.name}</span>
                                            <span className={styles.chartMeta}>{staffMember.appointments} appointments</span>
                                        </div>
                                        <span className={styles.chartValue}>{formatCurrency(staffMember.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
