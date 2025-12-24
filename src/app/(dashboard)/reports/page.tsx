"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { db, Customer, Staff, Service, Appointment, Bill } from "@/lib/database";
import styles from "./page.module.css";

export default function ReportsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState({
        todayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        totalCustomers: 0,
        newCustomersThisMonth: 0,
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        topServices: [] as { name: string; count: number; revenue: number }[],
        staffPerformance: [] as { name: string; appointments: number; revenue: number }[],
    });

    useEffect(() => {
        if (!db.auth.isOnboardingComplete()) {
            router.push("/onboarding");
            return;
        }

        calculateReports();
    }, [router]);

    const calculateReports = () => {
        const customers = db.customers.getAll();
        const appointments = db.appointments.getAll();
        const services = db.services.getAll();
        const staff = db.staff.getAll();
        const bills = db.bills.getAll();

        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // New customers this month
        const newCustomersThisMonth = customers.filter(c => new Date(c.createdAt) >= monthAgo).length;

        // Top services by booking count
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

        // Staff performance
        const staffStats: Record<string, { appointments: number; revenue: number }> = {};
        appointments.forEach(apt => {
            if (!staffStats[apt.staffId]) staffStats[apt.staffId] = { appointments: 0, revenue: 0 };
            staffStats[apt.staffId].appointments++;
        });

        bills.forEach(bill => {
            const apt = appointments.find(a => a.id === bill.appointmentId);
            if (apt && staffStats[apt.staffId]) {
                staffStats[apt.staffId].revenue += bill.finalAmount;
            }
        });

        const staffPerformance = Object.entries(staffStats)
            .map(([id, data]) => ({
                name: staff.find(s => s.id === id)?.name || 'Unknown',
                appointments: data.appointments,
                revenue: data.revenue,
            }))
            .sort((a, b) => b.appointments - a.appointments)
            .slice(0, 5);

        setData({
            todayRevenue: db.bills.getTodayRevenue(),
            weekRevenue: db.bills.getWeekRevenue(),
            monthRevenue: db.bills.getMonthRevenue(),
            totalCustomers: customers.length,
            newCustomersThisMonth,
            totalAppointments: appointments.length,
            completedAppointments: appointments.filter(a => a.status === 'completed').length,
            cancelledAppointments: appointments.filter(a => a.status === 'cancelled').length,
            topServices,
            staffPerformance,
        });

        setIsLoading(false);
    };

    const formatCurrency = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
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
                                {data.staffPerformance.map((staff, idx) => (
                                    <div key={idx} className={styles.chartItem}>
                                        <div className={styles.chartRank}>{idx + 1}</div>
                                        <div className={styles.chartInfo}>
                                            <span className={styles.chartName}>{staff.name}</span>
                                            <span className={styles.chartMeta}>{staff.appointments} appointments</span>
                                        </div>
                                        <span className={styles.chartValue}>{formatCurrency(staff.revenue)}</span>
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
