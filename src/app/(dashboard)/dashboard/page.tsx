"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import SalonCard from "@/components/dashboard/SalonCard";
import BookingsTable from "@/components/dashboard/BookingsTable";
import QuickActions from "@/components/dashboard/QuickActions";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { useSession } from "@/lib/SessionContext";
import { useMultiRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

interface Customer {
    id: string;
    name: string;
    phone: string;
}

interface Service {
    id: string;
    name: string;
    price: number;
    isActive: boolean;
}

interface Staff {
    id: string;
    name: string;
    role: string;
    isActive: boolean;
}

interface Appointment {
    id: string;
    customerId: string;
    staffId: string;
    serviceIds: string[];
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: string;
}

interface DashboardStats {
    totalClients: number;
    activeServices: number;
    staffMembers: number;
    todayAppointments: number;
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
}

export default function DashboardPage() {
    const { session, loading } = useSession();
    const [isLoading, setIsLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalClients: 0,
        activeServices: 0,
        staffMembers: 0,
        todayAppointments: 0,
        todayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
    });

    const loadData = useCallback(async () => {
        try {
            // Fetch all data in parallel
            const [customersRes, servicesRes, staffRes, appointmentsRes, revenueRes] = await Promise.all([
                fetch('/api/customers'),
                fetch('/api/services'),
                fetch('/api/staff'),
                fetch('/api/appointments'),
                fetch('/api/reports/revenue').catch(() => null), // Revenue API might not exist
            ]);

            // Parse customers
            if (customersRes.ok) {
                const data = await customersRes.json();
                setCustomers(data.customers || []);
            }

            // Parse services
            if (servicesRes.ok) {
                const data = await servicesRes.json();
                const allServices = data.services || [];
                setServices(allServices);
            }

            // Parse staff
            if (staffRes.ok) {
                const data = await staffRes.json();
                setStaff(data.staff || []);
            }

            // Parse appointments
            let todayAppointments: Appointment[] = [];
            if (appointmentsRes.ok) {
                const data = await appointmentsRes.json();
                const allAppointments = data.appointments || [];
                setAppointments(allAppointments);

                // Filter today's appointments
                const today = new Date().toISOString().split('T')[0];
                todayAppointments = allAppointments.filter((a: Appointment) =>
                    a.appointmentDate === today && a.status !== 'cancelled'
                );
            }

            // Parse revenue stats
            let revenueData = { today: 0, week: 0, month: 0 };
            if (revenueRes && revenueRes.ok) {
                const data = await revenueRes.json();
                revenueData = data;
            }

            // Update stats
            setStats({
                totalClients: customers.length,
                activeServices: services.filter(s => s.isActive !== false).length,
                staffMembers: staff.filter(s => s.isActive !== false).length,
                todayAppointments: todayAppointments.length,
                todayRevenue: revenueData.today || 0,
                weekRevenue: revenueData.week || 0,
                monthRevenue: revenueData.month || 0,
            });

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Update stats when data changes
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayAppts = appointments.filter(a =>
            a.appointmentDate === today && a.status !== 'cancelled'
        );

        setStats(prev => ({
            ...prev,
            totalClients: customers.length,
            activeServices: services.filter(s => s.isActive !== false).length,
            staffMembers: staff.filter(s => s.isActive !== false).length,
            todayAppointments: todayAppts.length,
        }));
    }, [customers, services, staff, appointments]);

    // Realtime sync - auto-refresh when data changes
    useMultiRealtimeSync(
        ['customers', 'services', 'staff', 'appointments', 'bills'],
        loadData,
        true
    );

    if (loading || isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    const salonName = session?.salon?.name || 'Your Salon';

    // Get today's appointments for the table
    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = appointments.filter(a =>
        a.appointmentDate === today
    ).slice(0, 5); // Show only first 5

    return (
        <>
            <Header
                title="Dashboard"
                subtitle={`Welcome back, ${salonName}`}
            />

            <div className={styles.content}>
                {/* Stats Row */}
                <div className={styles.statsGrid}>
                    <StatsCard
                        title="Total Customers"
                        value={stats.totalClients.toString()}
                        icon="users"
                        variant="rose"
                    />
                    <StatsCard
                        title="Active Services"
                        value={stats.activeServices.toString()}
                        icon="scissors"
                        variant="champagne"
                    />
                    <StatsCard
                        title="Staff Members"
                        value={stats.staffMembers.toString()}
                        icon="team"
                        variant="lavender"
                    />
                    <StatsCard
                        title="Today's Appointments"
                        value={stats.todayAppointments.toString()}
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
                            appointments={todayAppointments}
                            customers={customers}
                            staff={staff}
                            services={services}
                        />

                        {/* Revenue Chart */}
                        <RevenueChart
                            todayRevenue={stats.todayRevenue}
                            weekRevenue={stats.weekRevenue}
                            monthRevenue={stats.monthRevenue}
                        />
                    </div>

                    {/* Right Column */}
                    <div className={styles.rightColumn}>
                        <SalonCard salon={session?.salon ? {
                            id: session.salon.id,
                            name: session.salon.name,
                            ownerEmail: session.salon.email,
                            phone: '',
                            city: '',
                            status: 'active' as const,
                            createdAt: new Date().toISOString(),
                        } : null} />
                    </div>
                </div>
            </div>
        </>
    );
}
