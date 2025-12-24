"use client";

import styles from "./RevenueChart.module.css";

interface RevenueChartProps {
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
}

export default function RevenueChart({ todayRevenue, weekRevenue, monthRevenue }: RevenueChartProps) {
    // Simple bar chart data
    const maxRevenue = Math.max(todayRevenue, weekRevenue / 7, monthRevenue / 30) || 1;

    const formatCurrency = (amount: number) => {
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
        if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
        return `₹${amount}`;
    };

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Revenue Overview</h3>

            <div className={styles.metrics}>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>{formatCurrency(todayRevenue)}</span>
                    <span className={styles.metricLabel}>Today</span>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>{formatCurrency(weekRevenue)}</span>
                    <span className={styles.metricLabel}>This Week</span>
                </div>
                <div className={styles.metric}>
                    <span className={styles.metricValue}>{formatCurrency(monthRevenue)}</span>
                    <span className={styles.metricLabel}>This Month</span>
                </div>
            </div>

            {/* Simple visual bars */}
            <div className={styles.bars}>
                <div className={styles.barGroup}>
                    <div className={styles.barLabel}>Today</div>
                    <div className={styles.barTrack}>
                        <div
                            className={styles.barFill}
                            style={{ width: `${(todayRevenue / maxRevenue) * 100}%` }}
                        ></div>
                    </div>
                </div>
                <div className={styles.barGroup}>
                    <div className={styles.barLabel}>Avg/Day (Week)</div>
                    <div className={styles.barTrack}>
                        <div
                            className={`${styles.barFill} ${styles.week}`}
                            style={{ width: `${((weekRevenue / 7) / maxRevenue) * 100}%` }}
                        ></div>
                    </div>
                </div>
                <div className={styles.barGroup}>
                    <div className={styles.barLabel}>Avg/Day (Month)</div>
                    <div className={styles.barTrack}>
                        <div
                            className={`${styles.barFill} ${styles.month}`}
                            style={{ width: `${((monthRevenue / 30) / maxRevenue) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {monthRevenue === 0 && (
                <p className={styles.emptyNote}>Complete your first billing to see revenue metrics</p>
            )}
        </div>
    );
}
