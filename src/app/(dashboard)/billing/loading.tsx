"use client";

import styles from "../loading.module.css";

export default function BillingLoading() {
    return (
        <div className={styles.loadingContainer}>
            {/* Header Skeleton */}
            <div className={styles.headerSkeleton}>
                <div className={styles.skeletonTitle}></div>
            </div>

            {/* Billing Grid - 2 column layout */}
            <div className={styles.contentGrid}>
                {/* Left - Services/Products */}
                <div className={styles.mainContent}>
                    <div className={styles.tableHeader}>
                        <div className={styles.skeletonTitle}></div>
                    </div>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className={styles.tableRow}>
                            <div className={styles.skeletonAvatar}></div>
                            <div className={styles.skeletonText}></div>
                            <div className={styles.skeletonSmall}></div>
                        </div>
                    ))}
                </div>

                {/* Right - Bill Summary */}
                <div className={styles.sideContent}>
                    <div className={styles.skeletonCard}></div>
                    <div className={styles.skeletonCard}></div>
                </div>
            </div>
        </div>
    );
}
