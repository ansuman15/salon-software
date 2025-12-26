"use client";

import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import SalonCard from "@/components/dashboard/SalonCard";
import BookingsTable from "@/components/dashboard/BookingsTable";
import QuickActions from "@/components/dashboard/QuickActions";
import RevenueChart from "@/components/dashboard/RevenueChart";
import { useSession } from "@/lib/SessionContext";
import styles from "./page.module.css";

export default function DashboardPage() {
    const { session, loading } = useSession();

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
            </div>
        );
    }

    const salonName = session?.salon?.name || 'Your Salon';

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
                        title="Total Clients"
                        value="0"
                        icon="users"
                        variant="rose"
                    />
                    <StatsCard
                        title="Active Services"
                        value="0"
                        icon="scissors"
                        variant="champagne"
                    />
                    <StatsCard
                        title="Staff Members"
                        value="0"
                        icon="team"
                        variant="lavender"
                    />
                    <StatsCard
                        title="Today's Appointments"
                        value="0"
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
                            appointments={[]}
                            customers={[]}
                            staff={[]}
                            services={[]}
                        />

                        {/* Revenue Chart */}
                        <RevenueChart
                            todayRevenue={0}
                            weekRevenue={0}
                            monthRevenue={0}
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
