"use client";

import styles from "./loading.module.css";

export default function DashboardLoading() {
    return (
        <div className={styles.loadingContainer}>
            {/* Header Skeleton */}
            <div className={styles.headerSkeleton}>
                <div className={styles.skeletonTitle}></div>
                <div className={styles.skeletonActions}>
                    <div className={styles.skeletonBtn}></div>
                </div>
            </div>

            {/* Stats Grid Skeleton */}
            <div className={styles.statsGrid}>
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={styles.statCard}>
                        <div className={styles.skeletonLabel}></div>
                        <div className={styles.skeletonValue}></div>
                    </div>
                ))}
            </div>

            {/* Content Skeleton */}
            <div className={styles.contentGrid}>
                <div className={styles.mainContent}>
                    <div className={styles.tableHeader}>
                        <div className={styles.skeletonTitle}></div>
                    </div>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={styles.tableRow}>
                            <div className={styles.skeletonAvatar}></div>
                            <div className={styles.skeletonText}></div>
                            <div className={styles.skeletonSmall}></div>
                        </div>
                    ))}
                </div>
                <div className={styles.sideContent}>
                    <div className={styles.skeletonCard}></div>
                </div>
            </div>
        </div>
    );
}
