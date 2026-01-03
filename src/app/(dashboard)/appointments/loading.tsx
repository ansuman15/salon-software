"use client";

import styles from "../loading.module.css";

export default function AppointmentsLoading() {
    return (
        <div className={styles.loadingContainer}>
            {/* Header Skeleton */}
            <div className={styles.headerSkeleton}>
                <div className={styles.skeletonTitle}></div>
                <div className={styles.skeletonActions}>
                    <div className={styles.skeletonBtn}></div>
                </div>
            </div>

            {/* Calendar/List Skeleton */}
            <div className={styles.mainContent}>
                <div className={styles.tableHeader}>
                    <div className={styles.skeletonTitle}></div>
                </div>
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className={styles.tableRow}>
                        <div className={styles.skeletonAvatar}></div>
                        <div className={styles.skeletonText}></div>
                        <div className={styles.skeletonSmall}></div>
                        <div className={styles.skeletonSmall}></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
