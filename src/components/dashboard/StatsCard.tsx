import styles from "./StatsCard.module.css";

const UsersIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const ScissorsIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" stroke="currentColor" strokeWidth="2" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const StaffIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" stroke="currentColor" strokeWidth="2" />
        <line x1="22" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

interface StatsCardProps {
    title: string;
    value: number | string;
    subtitle?: string;
    variant: "rose" | "champagne" | "lavender" | "white" | "mint";
    icon: "users" | "scissors" | "staff" | "calendar" | "team";
}

const iconMap = {
    users: <UsersIcon />,
    scissors: <ScissorsIcon />,
    staff: <StaffIcon />,
    calendar: <CalendarIcon />,
    team: <StaffIcon />,
};

export default function StatsCard({ title, value, subtitle, variant, icon }: StatsCardProps) {
    return (
        <div className={`${styles.card} ${styles[variant]}`}>
            <div className={styles.header}>
                <span className={styles.title}>{title}</span>
                <div className={styles.iconWrapper}>
                    {iconMap[icon]}
                </div>
            </div>

            <div className={styles.value}>{value}</div>

            {subtitle && (
                <div className={styles.footer}>
                    <span className={styles.subtitle}>{subtitle}</span>
                </div>
            )}
        </div>
    );
}
