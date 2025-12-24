import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import styles from "./layout.module.css";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={styles.layout}>
            <Sidebar />
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
