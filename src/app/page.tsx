"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import styles from "./page.module.css";

// Icons
const CheckIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const UsersIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const CreditCardIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
);

const ChartIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
);

const MessageIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
);

const ShieldIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const MenuIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
);

const CloseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const ChevronDown = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

// Features data
const features = [
    { icon: <CalendarIcon />, title: "Appointment Management", description: "Day & week calendar, walk-ins, advance bookings, and easy rescheduling" },
    { icon: <UsersIcon />, title: "Customer Management", description: "Detailed profiles, visit history, notes for better personalization" },
    { icon: <CreditCardIcon />, title: "Billing & Payments", description: "Cash, UPI, Card tracking with invoices and complete billing records" },
    { icon: <ChartIcon />, title: "Reports & Insights", description: "Daily & weekly revenue, top services, clear business visibility" },
    { icon: <MessageIcon />, title: "WhatsApp Integration", description: "Automated confirmations, reminders, and payment messages" },
    { icon: <ShieldIcon />, title: "Security & Reliability", description: "Secure cloud hosting, daily backups, role-based access control" }
];

// Challenges
const challenges = [
    "Manual appointment handling",
    "No structured customer history",
    "Difficulty tracking staff performance",
    "No reliable reports for decisions",
    "Appointment no-shows",
    "Risk of data loss"
];

// Pricing plans
const plans = [
    {
        name: "Core",
        price: "1,999",
        setup: "3,999",
        features: [
            "Appointments & calendar",
            "Customer management",
            "Staff & services",
            "Billing & basic reports",
            "Secure cloud hosting",
            "Email support"
        ],
        notIncluded: ["WhatsApp automation"]
    },
    {
        name: "Standard",
        price: "4,999",
        setup: "4,999",
        popular: true,
        features: [
            "Everything in Core",
            "Advanced reports",
            "Customer segmentation",
            "Staff performance insights",
            "No-show tracking",
            "WhatsApp confirmations",
            "300 WhatsApp/month",
            "Priority support"
        ]
    },
    {
        name: "Premium",
        price: "6,999",
        setup: "2,999",
        features: [
            "Everything in Standard",
            "Multi-branch ready",
            "Advanced permissions",
            "Audit logs",
            "Priority onboarding",
            "Dedicated support",
            "1,000 WhatsApp/month",
            "Multiple reminders"
        ]
    }
];

// FAQ items
const faqs = [
    { question: "How long does implementation take?", answer: "Most salons can start using the system within a few days. We provide guided onboarding (30-45 minutes), staff configuration, and go-live support." },
    { question: "Is my data secure?", answer: "Yes. We use secure cloud hosting with daily automated backups, data isolation per salon, and role-based access control." },
    { question: "Can I upgrade my plan later?", answer: "Absolutely! You can upgrade anytime. Your data and settings carry over seamlessly." },
    { question: "What about WhatsApp limits?", answer: "Each plan has specific WhatsApp conversation limits. You can purchase add-on bundles: +300 for ₹499, +1,000 for ₹1,499, or unlimited for ₹2,999." },
    { question: "Do you offer refunds?", answer: "We offer a 14-day free trial. If you're not satisfied, cancel anytime during the trial period." }
];

// Scroll animation hook
function useScrollAnimation() {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1 }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, []);

    return { ref, isVisible };
}

// Animated section component
function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
    const { ref, isVisible } = useScrollAnimation();
    return (
        <div
            ref={ref}
            className={`${styles.animated} ${isVisible ? styles.visible : ""} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

export default function LandingPage() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className={styles.page}>
            {/* Navigation */}
            <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
                <div className={styles.navContainer}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>S</span>
                        <span className={styles.logoText}>SalonX</span>
                    </Link>

                    <div className={styles.navLinks}>
                        <a href="#features" className={styles.navLink}>Features</a>
                        <a href="#pricing" className={styles.navLink}>Pricing</a>
                        <a href="#faq" className={styles.navLink}>FAQ</a>
                    </div>

                    <div className={styles.navActions}>
                        <Link href="/login" className={styles.loginBtn}>Login</Link>
                        <Link href="/auth" className={styles.ctaBtn}>Start Free Trial</Link>
                    </div>

                    <button className={styles.mobileMenuBtn} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
                    </button>
                </div>

                {mobileMenuOpen && (
                    <div className={styles.mobileMenu}>
                        <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
                        <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
                        <a href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
                        <Link href="/login">Login</Link>
                        <Link href="/auth" className={styles.ctaBtn}>Start Free Trial</Link>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.badge}>
                        <span className={styles.badgePulse}></span>
                        <span>🇮🇳 Built for Indian Salons</span>
                    </div>
                    <h1 className={styles.heroTitle}>
                        Salon operations
                        <span className={styles.gradient}> simplified</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Manage appointments, customers, staff, billing & more — all in one
                        simple, secure, cloud-based system designed specifically for modern salons.
                    </p>
                    <div className={styles.heroCta}>
                        <Link href="/auth" className={styles.primaryBtn}>
                            <span>Start 14-Day Free Trial</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </Link>
                        <a href="#features" className={styles.secondaryBtn}>
                            See Features
                        </a>
                    </div>
                    <p className={styles.heroNote}>
                        ✓ No credit card required &nbsp; ✓ 14-day free trial &nbsp; ✓ Cancel anytime
                    </p>
                </div>

                <div className={styles.heroVisual}>
                    <div className={styles.dashboardMockup}>
                        <div className={styles.mockupHeader}>
                            <div className={styles.mockupDots}>
                                <span></span><span></span><span></span>
                            </div>
                            <span className={styles.mockupTitle}>SalonX Dashboard</span>
                        </div>
                        <div className={styles.mockupBody}>
                            {/* Stats Row */}
                            <div className={styles.mockupStats}>
                                <div className={`${styles.mockupCard} ${styles.card1}`}>
                                    <span className={styles.cardLabel}>Today's Appointments</span>
                                    <span className={styles.cardValue}>12</span>
                                </div>
                                <div className={`${styles.mockupCard} ${styles.card2}`}>
                                    <span className={styles.cardLabel}>Revenue Today</span>
                                    <span className={styles.cardValue}>₹24,500</span>
                                </div>
                                <div className={`${styles.mockupCard} ${styles.card3}`}>
                                    <span className={styles.cardLabel}>Active Customers</span>
                                    <span className={styles.cardValue}>847</span>
                                </div>
                            </div>
                            {/* Table Preview */}
                            <div className={styles.mockupTable}>
                                <div className={styles.tableHeader}>
                                    <span>Upcoming Appointments</span>
                                </div>
                                <div className={styles.tableRow}>
                                    <div className={styles.tableAvatar}>P</div>
                                    <div className={styles.tableInfo}>
                                        <span>Priya Sharma</span>
                                        <span>Haircut + Styling</span>
                                    </div>
                                    <span className={styles.tableTime}>10:30 AM</span>
                                </div>
                                <div className={styles.tableRow}>
                                    <div className={styles.tableAvatar}>R</div>
                                    <div className={styles.tableInfo}>
                                        <span>Rahul Verma</span>
                                        <span>Beard Trim</span>
                                    </div>
                                    <span className={styles.tableTime}>11:00 AM</span>
                                </div>
                                <div className={styles.tableRow}>
                                    <div className={styles.tableAvatar}>A</div>
                                    <div className={styles.tableInfo}>
                                        <span>Anjali Gupta</span>
                                        <span>Hair Spa</span>
                                    </div>
                                    <span className={styles.tableTime}>11:30 AM</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Floating elements */}
                    <div className={styles.floatingCard1}>
                        <span className={styles.floatingIcon}>📅</span>
                        <span>New booking confirmed!</span>
                    </div>
                    <div className={styles.floatingCard2}>
                        <span className={styles.floatingIcon}>💰</span>
                        <span>₹2,500 payment received</span>
                    </div>
                </div>
            </section>

            {/* Trusted By */}
            <AnimatedSection className={styles.trusted}>
                <p>Trusted by <strong>500+</strong> salons across India</p>
                <div className={styles.trustedLogos}>
                    <span>Mumbai</span>
                    <span>Delhi</span>
                    <span>Bangalore</span>
                    <span>Hyderabad</span>
                    <span>Chennai</span>
                </div>
            </AnimatedSection>

            {/* Problems Section */}
            <section className={styles.problems}>
                <AnimatedSection>
                    <div className={styles.sectionHeader}>
                        <h2>Running a salon shouldn't be this hard</h2>
                        <p>Most salons struggle with these common challenges</p>
                    </div>
                </AnimatedSection>
                <div className={styles.problemsGrid}>
                    {challenges.map((challenge, i) => (
                        <AnimatedSection key={i} delay={i * 100}>
                            <div className={styles.problemCard}>
                                <span className={styles.problemX}>✕</span>
                                <span>{challenge}</span>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className={styles.features}>
                <AnimatedSection>
                    <div className={styles.sectionHeader}>
                        <h2>Everything you need to run your salon</h2>
                        <p>A complete solution that grows with your business</p>
                    </div>
                </AnimatedSection>
                <div className={styles.featuresGrid}>
                    {features.map((feature, i) => (
                        <AnimatedSection key={i} delay={i * 100}>
                            <div className={styles.featureCard}>
                                <div className={styles.featureIcon}>{feature.icon}</div>
                                <h3>{feature.title}</h3>
                                <p>{feature.description}</p>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
            </section>

            {/* Stats Section */}
            <AnimatedSection className={styles.stats}>
                <div className={styles.statsContent}>
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>2,500+</span>
                        <span className={styles.statLabel}>Salons trust us</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>1M+</span>
                        <span className={styles.statLabel}>Appointments managed</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>99.9%</span>
                        <span className={styles.statLabel}>Uptime guaranteed</span>
                    </div>
                </div>
            </AnimatedSection>

            {/* Pricing Section */}
            <section id="pricing" className={styles.pricing}>
                <AnimatedSection>
                    <div className={styles.sectionHeader}>
                        <h2>Simple, transparent pricing</h2>
                        <p>Start with a 14-day free trial • No credit card required</p>
                    </div>
                </AnimatedSection>
                <div className={styles.pricingGrid}>
                    {plans.map((plan, i) => (
                        <AnimatedSection key={i} delay={i * 150}>
                            <div className={`${styles.pricingCard} ${plan.popular ? styles.popular : ""}`}>
                                {plan.popular && <div className={styles.popularBadge}>Most Popular</div>}
                                <h3 className={styles.planName}>{plan.name}</h3>
                                <div className={styles.planPrice}>
                                    <span className={styles.currency}>₹</span>
                                    <span className={styles.amount}>{plan.price}</span>
                                    <span className={styles.period}>/month</span>
                                </div>
                                <p className={styles.setupFee}>One-time setup: ₹{plan.setup}</p>
                                <ul className={styles.planFeatures}>
                                    {plan.features.map((feature, j) => (
                                        <li key={j}><CheckIcon /><span>{feature}</span></li>
                                    ))}
                                    {plan.notIncluded?.map((item, j) => (
                                        <li key={`not-${j}`} className={styles.notIncluded}>
                                            <span className={styles.xMark}>✕</span>
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Link href="/auth" className={styles.planBtn}>Start Free Trial</Link>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
                <AnimatedSection className={styles.addons}>
                    <h4>WhatsApp Add-on Bundles</h4>
                    <div className={styles.addonGrid}>
                        <div className={styles.addon}>+300 conversations <strong>₹499</strong></div>
                        <div className={styles.addon}>+1,000 conversations <strong>₹1,499</strong></div>
                        <div className={styles.addon}>Unlimited <strong>₹2,999</strong></div>
                    </div>
                </AnimatedSection>
            </section>

            {/* FAQ Section */}
            <section id="faq" className={styles.faq}>
                <AnimatedSection>
                    <div className={styles.sectionHeader}>
                        <h2>Frequently asked questions</h2>
                        <p>Everything you need to know about SalonX</p>
                    </div>
                </AnimatedSection>
                <div className={styles.faqList}>
                    {faqs.map((faq, i) => (
                        <AnimatedSection key={i} delay={i * 100}>
                            <div className={`${styles.faqItem} ${openFaq === i ? styles.open : ""}`}>
                                <button className={styles.faqQuestion} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                    <span>{faq.question}</span>
                                    <ChevronDown />
                                </button>
                                <div className={styles.faqAnswer}><p>{faq.answer}</p></div>
                            </div>
                        </AnimatedSection>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <AnimatedSection className={styles.finalCta}>
                <h2>Ready to transform your salon?</h2>
                <p>Join 500+ salons already using SalonX to streamline operations</p>
                <Link href="/auth" className={styles.primaryBtn}>
                    <span>Start Your 14-Day Free Trial</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </Link>
            </AnimatedSection>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.footerBrand}>
                        <div className={styles.logo}>
                            <span className={styles.logoIcon}>S</span>
                            <span className={styles.logoText}>SalonX</span>
                        </div>
                        <p>Modern salon management software built for Indian salons.</p>
                    </div>
                    <div className={styles.footerLinks}>
                        <div>
                            <h4>Product</h4>
                            <a href="#features">Features</a>
                            <a href="#pricing">Pricing</a>
                            <a href="#faq">FAQ</a>
                        </div>
                        <div>
                            <h4>Company</h4>
                            <a href="#">About</a>
                            <a href="#">Contact</a>
                            <a href="#">Support</a>
                        </div>
                        <div>
                            <h4>Legal</h4>
                            <a href="#">Privacy Policy</a>
                            <a href="#">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div className={styles.footerBottom}>
                    <p>© 2024 SalonX. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
