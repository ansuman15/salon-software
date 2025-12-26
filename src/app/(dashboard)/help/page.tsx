"use client";

import Header from "@/components/layout/Header";
import { useSession } from "@/lib/SessionContext";
import styles from "./page.module.css";

export default function HelpPage() {
    const { session, loading } = useSession();

    if (loading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Help & Support" subtitle="Get assistance with SalonX" />

            <div className={styles.container}>
                {/* Contact Support */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Contact Support</h2>
                    <p className={styles.sectionDesc}>
                        Need help? Our support team is here to assist you.
                    </p>

                    <div className={styles.contactGrid}>
                        <div className={styles.contactCard}>
                            <div className={styles.contactIcon}>📧</div>
                            <h3>Email Support</h3>
                            <p>Send us an email and we'll respond within 24 hours</p>
                            <a href="mailto:convertrix.co@gmail.com" className={styles.contactLink}>
                                convertrix.co@gmail.com
                            </a>
                        </div>

                        <div className={styles.contactCard}>
                            <div className={styles.contactIcon}>📞</div>
                            <h3>Phone Support</h3>
                            <p>Call us during business hours (9 AM - 6 PM IST)</p>
                            <a href="tel:+917854987173" className={styles.contactLink}>
                                +91 7854 987 173
                            </a>
                        </div>

                        <div className={styles.contactCard}>
                            <div className={styles.contactIcon}>💬</div>
                            <h3>WhatsApp</h3>
                            <p>Quick support via WhatsApp</p>
                            <a
                                href="https://wa.me/917854987173"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.contactLink}
                            >
                                Chat on WhatsApp
                            </a>
                        </div>
                    </div>
                </section>

                {/* FAQs */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>

                    <div className={styles.faqList}>
                        <div className={styles.faqItem}>
                            <h4>How do I add staff members?</h4>
                            <p>Go to Staff → Click "Add Staff" → Fill in details → Save</p>
                        </div>

                        <div className={styles.faqItem}>
                            <h4>How do I create a new appointment?</h4>
                            <p>Go to Appointments → Click "New Appointment" → Select customer, service, and time → Save</p>
                        </div>

                        <div className={styles.faqItem}>
                            <h4>How do I generate an invoice?</h4>
                            <p>Go to Billing → Complete the appointment → Invoice is automatically generated</p>
                        </div>

                        <div className={styles.faqItem}>
                            <h4>How do I track attendance?</h4>
                            <p>Go to Attendance → Select the date → Mark each staff member's status → Save</p>
                        </div>

                        <div className={styles.faqItem}>
                            <h4>How do I view reports?</h4>
                            <p>Go to Reports → Select the report type → Choose date range → View or export</p>
                        </div>
                    </div>
                </section>

                {/* Quick Links */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Quick Links</h2>
                    <div className={styles.quickLinks}>
                        <a href="/dashboard" className={styles.quickLink}>Dashboard</a>
                        <a href="/settings" className={styles.quickLink}>Settings</a>
                        <a href="/appointments" className={styles.quickLink}>Appointments</a>
                        <a href="/staff" className={styles.quickLink}>Staff</a>
                    </div>
                </section>
            </div>
        </>
    );
}
