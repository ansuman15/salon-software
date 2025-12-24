"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/database";
import styles from "./page.module.css";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [setupComplete, setSetupComplete] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        // Step 1: Admin credentials
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        confirmPassword: "",

        // Step 2: Salon details
        salonName: "",
        phone: "",
        city: "",
        currency: "INR",
        timezone: "Asia/Kolkata",
        logoUrl: "",

        // Step 3: Working hours
        openingTime: "09:00",
        closingTime: "21:00",
        workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat

        // Step 4: Services (optional starter)
        services: [] as { name: string; category: string; duration: number; price: number }[],

        // Step 5: Staff (optional starter)
        staff: [] as { name: string; role: string; phone: string }[],

        // Step 6: Billing settings
        gstPercentage: 0,
        invoicePrefix: "INV",
        whatsappEnabled: false,
        whatsappNumber: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        // Check if already onboarded
        if (db.auth.isOnboardingComplete()) {
            router.push("/dashboard");
        }
    }, [router]);

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const validateStep = (step: Step): boolean => {
        const newErrors: Record<string, string> = {};

        if (step === 1) {
            if (!formData.adminName.trim()) newErrors.adminName = "Name is required";
            if (!formData.adminEmail.trim()) newErrors.adminEmail = "Email is required";
            if (!/\S+@\S+\.\S+/.test(formData.adminEmail)) newErrors.adminEmail = "Invalid email";
            if (!formData.adminPassword) newErrors.adminPassword = "Password is required";
            if (formData.adminPassword.length < 6) newErrors.adminPassword = "Password must be at least 6 characters";
            if (formData.adminPassword !== formData.confirmPassword) newErrors.confirmPassword = "Passwords don't match";
        }

        if (step === 2) {
            if (!formData.salonName.trim()) newErrors.salonName = "Salon name is required";
            if (!formData.phone.trim()) newErrors.phone = "Phone is required";
            if (!formData.city.trim()) newErrors.city = "City is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < 6) {
                setCurrentStep((currentStep + 1) as Step);
            } else if (currentStep === 6) {
                handleComplete();
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep((currentStep - 1) as Step);
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setLogoPreview(base64);
                setFormData({ ...formData, logoUrl: base64 });
            };
            reader.readAsDataURL(file);
        }
    };

    const toggleDay = (dayIndex: number) => {
        setFormData(prev => ({
            ...prev,
            workingDays: prev.workingDays.includes(dayIndex)
                ? prev.workingDays.filter(d => d !== dayIndex)
                : [...prev.workingDays, dayIndex].sort()
        }));
    };

    const handleComplete = async () => {
        setIsLoading(true);

        try {
            // Complete onboarding
            const { salon, user } = db.completeOnboarding(
                {
                    name: formData.salonName,
                    phone: formData.phone,
                    city: formData.city,
                    currency: formData.currency,
                    timezone: formData.timezone,
                    logoUrl: formData.logoUrl,
                },
                {
                    name: formData.adminName,
                    email: formData.adminEmail,
                    password: formData.adminPassword,
                },
                {
                    openingTime: formData.openingTime,
                    closingTime: formData.closingTime,
                    workingDays: formData.workingDays,
                    gstPercentage: formData.gstPercentage,
                    invoicePrefix: formData.invoicePrefix,
                    whatsappEnabled: formData.whatsappEnabled,
                    whatsappNumber: formData.whatsappNumber,
                }
            );

            // Add staff members
            formData.staff.forEach(staff => {
                db.staff.create({
                    salonId: salon.id,
                    name: staff.name,
                    role: staff.role,
                    phone: staff.phone,
                    isActive: true,
                    serviceIds: [],
                });
            });

            // Add services
            formData.services.forEach(service => {
                db.services.create({
                    salonId: salon.id,
                    name: service.name,
                    category: service.category,
                    durationMinutes: service.duration,
                    price: service.price,
                    isActive: true,
                });
            });

            // Create sample customer (to avoid empty state)
            const sampleCustomer = db.customers.create({
                salonId: salon.id,
                name: "Sample Customer",
                phone: "+91 98765 00001",
                email: "sample@example.com",
                tags: ["New"],
            });

            // Create sample appointment for today if we have staff and services
            const allStaff = db.staff.getAll();
            const allServices = db.services.getAll();
            const today = new Date().toISOString().split('T')[0];

            if (allStaff.length > 0 && allServices.length > 0) {
                db.appointments.create({
                    salonId: salon.id,
                    customerId: sampleCustomer.id,
                    staffId: allStaff[0].id,
                    appointmentDate: today,
                    startTime: "10:00",
                    endTime: "10:30",
                    status: "confirmed",
                    serviceIds: [allServices[0].id],
                    notes: "Sample appointment - feel free to edit or delete",
                });
            }

            // Show success screen
            setSetupComplete(true);
            setCurrentStep(7);
        } catch (error) {
            console.error("Onboarding error:", error);
            setErrors({ submit: "Something went wrong. Please try again." });
        } finally {
            setIsLoading(false);
        }
    };

    const addService = () => {
        setFormData(prev => ({
            ...prev,
            services: [...prev.services, { name: "", category: "Hair", duration: 30, price: 500 }]
        }));
    };

    const updateService = (index: number, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.map((s, i) => i === index ? { ...s, [field]: value } : s)
        }));
    };

    const removeService = (index: number) => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.filter((_, i) => i !== index)
        }));
    };

    const addStaff = () => {
        setFormData(prev => ({
            ...prev,
            staff: [...prev.staff, { name: "", role: "Stylist", phone: "" }]
        }));
    };

    const updateStaff = (index: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            staff: prev.staff.map((s, i) => i === index ? { ...s, [field]: value } : s)
        }));
    };

    const removeStaff = (index: number) => {
        setFormData(prev => ({
            ...prev,
            staff: prev.staff.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                {/* Progress */}
                <div className={styles.progress}>
                    {[1, 2, 3, 4, 5, 6].map((step) => (
                        <div
                            key={step}
                            className={`${styles.progressStep} ${currentStep >= step ? styles.active : ''}`}
                        >
                            <div className={styles.progressDot}>{step}</div>
                            <span className={styles.progressLabel}>
                                {step === 1 && "Admin"}
                                {step === 2 && "Salon"}
                                {step === 3 && "Hours"}
                                {step === 4 && "Services"}
                                {step === 5 && "Staff"}
                                {step === 6 && "Billing"}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Step 1: Admin Credentials */}
                {currentStep === 1 && (
                    <div className={styles.stepContent}>
                        <h1 className={styles.title}>Create Admin Account</h1>
                        <p className={styles.subtitle}>Set up your login credentials to access the system</p>

                        <div className={styles.form}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Your Name</label>
                                <input
                                    type="text"
                                    className={`${styles.input} ${errors.adminName ? styles.error : ''}`}
                                    value={formData.adminName}
                                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                                    placeholder="John Doe"
                                />
                                {errors.adminName && <span className={styles.errorText}>{errors.adminName}</span>}
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Email Address</label>
                                <input
                                    type="email"
                                    className={`${styles.input} ${errors.adminEmail ? styles.error : ''}`}
                                    value={formData.adminEmail}
                                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                                    placeholder="admin@yoursalon.com"
                                />
                                {errors.adminEmail && <span className={styles.errorText}>{errors.adminEmail}</span>}
                            </div>

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Password</label>
                                    <input
                                        type="password"
                                        className={`${styles.input} ${errors.adminPassword ? styles.error : ''}`}
                                        value={formData.adminPassword}
                                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                    {errors.adminPassword && <span className={styles.errorText}>{errors.adminPassword}</span>}
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Confirm Password</label>
                                    <input
                                        type="password"
                                        className={`${styles.input} ${errors.confirmPassword ? styles.error : ''}`}
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        placeholder="••••••••"
                                    />
                                    {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword}</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Salon Details */}
                {currentStep === 2 && (
                    <div className={styles.stepContent}>
                        <h1 className={styles.title}>Salon Details</h1>
                        <p className={styles.subtitle}>Tell us about your salon</p>

                        <div className={styles.form}>
                            <div className={styles.logoUpload}>
                                <div className={styles.logoPreview}>
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo" />
                                    ) : (
                                        <span>Logo</span>
                                    )}
                                </div>
                                <div className={styles.logoInfo}>
                                    <label className={styles.uploadBtn}>
                                        Upload Logo
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} hidden />
                                    </label>
                                    <span className={styles.logoHint}>JPG, PNG up to 2MB (Optional)</span>
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Salon Name *</label>
                                <input
                                    type="text"
                                    className={`${styles.input} ${errors.salonName ? styles.error : ''}`}
                                    value={formData.salonName}
                                    onChange={(e) => setFormData({ ...formData, salonName: e.target.value })}
                                    placeholder="My Awesome Salon"
                                />
                                {errors.salonName && <span className={styles.errorText}>{errors.salonName}</span>}
                            </div>

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Phone *</label>
                                    <input
                                        type="tel"
                                        className={`${styles.input} ${errors.phone ? styles.error : ''}`}
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+91 98765 43210"
                                    />
                                    {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>City *</label>
                                    <input
                                        type="text"
                                        className={`${styles.input} ${errors.city ? styles.error : ''}`}
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="Mumbai"
                                    />
                                    {errors.city && <span className={styles.errorText}>{errors.city}</span>}
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Currency</label>
                                    <select
                                        className={styles.select}
                                        value={formData.currency}
                                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                    >
                                        <option value="INR">INR (₹)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="EUR">EUR (€)</option>
                                    </select>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Timezone</label>
                                    <select
                                        className={styles.select}
                                        value={formData.timezone}
                                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                    >
                                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                        <option value="America/New_York">America/New_York (EST)</option>
                                        <option value="Europe/London">Europe/London (GMT)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Working Hours */}
                {currentStep === 3 && (
                    <div className={styles.stepContent}>
                        <h1 className={styles.title}>Working Hours</h1>
                        <p className={styles.subtitle}>When is your salon open?</p>

                        <div className={styles.form}>
                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Opening Time</label>
                                    <input
                                        type="time"
                                        className={styles.input}
                                        value={formData.openingTime}
                                        onChange={(e) => setFormData({ ...formData, openingTime: e.target.value })}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Closing Time</label>
                                    <input
                                        type="time"
                                        className={styles.input}
                                        value={formData.closingTime}
                                        onChange={(e) => setFormData({ ...formData, closingTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Working Days</label>
                                <div className={styles.daysGrid}>
                                    {days.map((day, idx) => (
                                        <button
                                            key={day}
                                            type="button"
                                            className={`${styles.dayBtn} ${formData.workingDays.includes(idx) ? styles.active : ''}`}
                                            onClick={() => toggleDay(idx)}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Services */}
                {currentStep === 4 && (
                    <div className={styles.stepContent}>
                        <h1 className={styles.title}>Add Services</h1>
                        <p className={styles.subtitle}>Add your salon services (you can skip this and add later)</p>

                        <div className={styles.form}>
                            {formData.services.map((service, index) => (
                                <div key={index} className={styles.itemRow}>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={service.name}
                                        onChange={(e) => updateService(index, 'name', e.target.value)}
                                        placeholder="Service name"
                                    />
                                    <select
                                        className={styles.selectSmall}
                                        value={service.category}
                                        onChange={(e) => updateService(index, 'category', e.target.value)}
                                    >
                                        <option value="Hair">Hair</option>
                                        <option value="Skin">Skin</option>
                                        <option value="Nails">Nails</option>
                                        <option value="Spa">Spa</option>
                                    </select>
                                    <input
                                        type="number"
                                        className={styles.inputSmall}
                                        value={service.duration}
                                        onChange={(e) => updateService(index, 'duration', Number(e.target.value))}
                                        placeholder="Min"
                                    />
                                    <input
                                        type="number"
                                        className={styles.inputSmall}
                                        value={service.price}
                                        onChange={(e) => updateService(index, 'price', Number(e.target.value))}
                                        placeholder="Price"
                                    />
                                    <button type="button" className={styles.removeBtn} onClick={() => removeService(index)}>×</button>
                                </div>
                            ))}

                            <button type="button" className={styles.addBtn} onClick={addService}>
                                + Add Service
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 5: Staff */}
                {currentStep === 5 && (
                    <div className={styles.stepContent}>
                        <h1 className={styles.title}>Add Staff</h1>
                        <p className={styles.subtitle}>Add your team members (you can skip this and add later)</p>

                        <div className={styles.form}>
                            {formData.staff.map((member, index) => (
                                <div key={index} className={styles.itemRow}>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={member.name}
                                        onChange={(e) => updateStaff(index, 'name', e.target.value)}
                                        placeholder="Staff name"
                                    />
                                    <select
                                        className={styles.selectSmall}
                                        value={member.role}
                                        onChange={(e) => updateStaff(index, 'role', e.target.value)}
                                    >
                                        <option value="Stylist">Stylist</option>
                                        <option value="Therapist">Therapist</option>
                                        <option value="Barber">Barber</option>
                                        <option value="Receptionist">Receptionist</option>
                                    </select>
                                    <input
                                        type="tel"
                                        className={styles.input}
                                        value={member.phone}
                                        onChange={(e) => updateStaff(index, 'phone', e.target.value)}
                                        placeholder="Phone (optional)"
                                    />
                                    <button type="button" className={styles.removeBtn} onClick={() => removeStaff(index)}>×</button>
                                </div>
                            ))}

                            <button type="button" className={styles.addBtn} onClick={addStaff}>
                                + Add Staff Member
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 6: Billing Settings */}
                {currentStep === 6 && (
                    <div className={styles.stepContent}>
                        <h1 className={styles.title}>Billing Settings</h1>
                        <p className={styles.subtitle}>Configure your billing preferences</p>

                        <div className={styles.form}>
                            <div className={styles.row}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>GST Percentage (%)</label>
                                    <input
                                        type="number"
                                        className={styles.input}
                                        value={formData.gstPercentage}
                                        onChange={(e) => setFormData({ ...formData, gstPercentage: Number(e.target.value) })}
                                        min={0}
                                        max={100}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Invoice Prefix</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={formData.invoicePrefix}
                                        onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.toggleRow}>
                                <div className={styles.toggleInfo}>
                                    <span className={styles.toggleLabel}>Enable WhatsApp Notifications</span>
                                    <span className={styles.toggleDesc}>Send booking confirmations and reminders</span>
                                </div>
                                <button
                                    type="button"
                                    className={`${styles.toggle} ${formData.whatsappEnabled ? styles.on : ''}`}
                                    onClick={() => setFormData({ ...formData, whatsappEnabled: !formData.whatsappEnabled })}
                                >
                                    <span className={styles.toggleKnob}></span>
                                </button>
                            </div>

                            {formData.whatsappEnabled && (
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>WhatsApp Business Number</label>
                                    <input
                                        type="tel"
                                        className={styles.input}
                                        value={formData.whatsappNumber}
                                        onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                                        placeholder="+91 98765 43210"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 7: Success Screen */}
                {currentStep === 7 && (
                    <div className={styles.successScreen}>
                        <div className={styles.successIcon}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </div>
                        <h1 className={styles.successTitle}>Setup Complete! 🎉</h1>
                        <p className={styles.successSubtitle}>Your salon system is now live and ready to use.</p>

                        <div className={styles.successActions}>
                            <button
                                className={styles.primaryAction}
                                onClick={() => router.push('/appointments')}
                            >
                                Book First Appointment
                            </button>
                            <button
                                className={styles.secondaryAction}
                                onClick={() => router.push('/dashboard')}
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                )}

                {/* Navigation - Only show for steps 1-6 */}
                {currentStep < 7 && (
                    <div className={styles.navigation}>
                        {currentStep > 1 && (
                            <button className={styles.backBtn} onClick={handleBack}>
                                Back
                            </button>
                        )}

                        <div className={styles.navSpacer}></div>

                        {currentStep < 6 ? (
                            <button className={styles.nextBtn} onClick={handleNext}>
                                Continue
                            </button>
                        ) : (
                            <button
                                className={styles.completeBtn}
                                onClick={handleNext}
                                disabled={isLoading}
                            >
                                {isLoading ? "Setting up..." : "Finish Setup"}
                            </button>
                        )}
                    </div>
                )}

                {errors.submit && (
                    <p className={styles.submitError}>{errors.submit}</p>
                )}
            </div>
        </div>
    );
}
