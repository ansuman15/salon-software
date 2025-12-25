"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import SalonCard from "@/components/dashboard/SalonCard";
import BookingsTable from "@/components/dashboard/BookingsTable";
import QuickActions from "@/components/dashboard/QuickActions";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { db, Salon, Customer, Staff, Service, Appointment, Bill } from "@/lib/database";
import styles from "./page.module.css";

interface DashboardData {
    salon: Salon | null;
    customers: Customer[];
    staff: Staff[];
    services: Service[];
    appointments: Appointment[];
    todayAppointments: Appointment[];
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData>({
        salon: null,
        customers: [],
        staff: [],
        services: [],
        appointments: [],
        todayAppointments: [],
        todayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load data from localStorage
        const today = new Date().toISOString().split('T')[0];
        const salon = db.salon.get();
        const customers = db.customers.getAll();
        const staff = db.staff.getAll();
        const services = db.services.getAll();
        const appointments = db.appointments.getAll();
        const todayAppointments = db.appointments.getByDate(today);

        setData({
            salon,
            customers,
            staff: staff.filter(s => s.isActive),
            services: services.filter(s => s.isActive),
            appointments,
            todayAppointments,
            todayRevenue: db.bills.getTodayRevenue(),
            weekRevenue: db.bills.getWeekRevenue(),
            monthRevenue: db.bills.getMonthRevenue(),
        });

        setIsLoading(false);
    }, [router]);

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    // Helper to get customer/staff/service names
    const getCustomerName = (id: string) => data.customers.find(c => c.id === id)?.name || 'Unknown';
    const getStaffName = (id: string) => data.staff.find(s => s.id === id)?.name || 'Unknown';
    const getServiceNames = (ids: string[]) =>
        ids.map(id => data.services.find(s => s.id === id)?.name || 'Unknown').join(', ');

    // Transform appointments for the table
    const tableAppointments = data.todayAppointments.map(apt => ({
        id: apt.id,
        employeeName: getStaffName(apt.staffId),
        service: getServiceNames(apt.serviceIds),
        status: apt.status,
        time: apt.startTime,
        customerName: getCustomerName(apt.customerId),
    }));

    return (
        <>
            <Header
                title="Dashboard"
                subtitle={`Welcome back${data.salon?.name ? `, ${data.salon.name}` : ''}`}
            />

            <div className={styles.content}>
                {/* Stats Row */}
                <div className={styles.statsGrid}>
                    <StatsCard
                        title="Total Clients"
                        value={data.customers.length.toString()}
                        icon="users"
                        variant="rose"
                    />
                    <StatsCard
                        title="Active Services"
                        value={data.services.length.toString()}
                        icon="scissors"
                        variant="champagne"
                    />
                    <StatsCard
                        title="Staff Members"
                        value={data.staff.length.toString()}
                        icon="team"
                        variant="lavender"
                    />
                    <StatsCard
                        title="Today's Appointments"
                        value={data.todayAppointments.length.toString()}
                        icon="calendar"
                        variant="mint"
                    />
                </div>

                {/* Quick Actions Row */}
                <QuickActions />

                {/* Main Grid */}
                <div className={styles.mainGrid}>
                    {/* Left Column */}
                    <div className={styles.leftColumn}>
                        {/* Bookings Table */}
                        <BookingsTable
                            appointments={tableAppointments}
                            customers={data.customers}
                            staff={data.staff}
                            services={data.services}
                        />

                        {/* Revenue Chart */}
                        <RevenueChart
                            todayRevenue={data.todayRevenue}
                            weekRevenue={data.weekRevenue}
                            monthRevenue={data.monthRevenue}
                        />
                    </div>

                    {/* Right Column */}
                    <div className={styles.rightColumn}>
                        <SalonCard salon={data.salon} />
                    </div>
                </div>
            </div>
        </>
    );
}
