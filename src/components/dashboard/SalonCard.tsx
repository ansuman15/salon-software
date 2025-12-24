"use client";

import { Salon } from "@/lib/database";
import styles from "./SalonCard.module.css";

interface SalonCardProps {
    salon: Salon | null;
}

export default function SalonCard({ salon }: SalonCardProps) {
    if (!salon) {
        return (
            <div className={styles.container}>
                <div className={styles.placeholder}>
                    <span>No salon configured</span>
                </div>
            </div>
        );
    }

    const getInitials = (name: string) =>
        name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                {salon.logoUrl ? (
                    <img src={salon.logoUrl} alt={salon.name} className={styles.logo} />
                ) : (
                    <div className={styles.logoPlaceholder}>
                        {getInitials(salon.name)}
                    </div>
                )}
            </div>

            <div className={styles.info}>
                <h3 className={styles.name}>{salon.name}</h3>
                <p className={styles.location}>{salon.city}</p>
                <p className={styles.phone}>{salon.phone}</p>
            </div>

            <div className={styles.meta}>
                <span className={styles.currency}>{salon.currency}</span>
                <span className={styles.timezone}>{salon.timezone?.split('/')[1] || 'IST'}</span>
            </div>
        </div>
    );
}
