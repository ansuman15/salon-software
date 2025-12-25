// Local Database Service using localStorage
// This provides a consistent API that can be swapped for Supabase in production

import { STORAGE_KEYS, ADMIN_EMAILS, ADMIN_CREDENTIALS, config, ONBOARDING_STATES } from './config';

// Types
export interface Session {
    userId: string;
    email: string;
    isAdmin: boolean;
    loginTime: string;
    expiresAt: string;
    version: string;
}

export interface OnboardingState {
    status: 'not_started' | 'in_progress' | 'completed';
    currentStep: number;
    lastUpdated: string;
    salonId?: string;
}

export interface Subscription {
    userId: string;
    plan: 'trial' | 'core' | 'standard' | 'premium';
    startDate: string;
    endDate: string;
    status: 'active' | 'expired' | 'cancelled';
}

export interface Salon {
    id: string;
    name: string;
    phone: string;
    city: string;
    currency: string;
    timezone: string;
    logoUrl?: string;
    createdAt: string;
}

export interface User {
    id: string;
    salonId: string;
    email: string;
    name: string;
    password: string; // In production, this would be hashed
    role: 'owner' | 'receptionist' | 'stylist';
    createdAt: string;
}

export interface Customer {
    id: string;
    salonId: string;
    name: string;
    phone: string;
    email?: string;
    gender?: string;
    notes?: string;
    tags: string[];
    createdAt: string;
}

export interface Staff {
    id: string;
    salonId: string;
    name: string;
    phone?: string;
    role: string;
    imageUrl?: string;
    isActive: boolean;
    serviceIds: string[];
    createdAt: string;
}

export interface Service {
    id: string;
    salonId: string;
    name: string;
    category: string;
    durationMinutes: number;
    price: number;
    description?: string;
    isActive: boolean;
}

export interface Appointment {
    id: string;
    salonId: string;
    customerId: string;
    staffId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    serviceIds: string[];
    notes?: string;
    createdAt: string;
}

export interface Bill {
    id: string;
    salonId: string;
    appointmentId: string;
    customerId: string;
    totalAmount: number;
    discount: number;
    taxAmount: number;
    finalAmount: number;
    paymentStatus: 'paid' | 'pending' | 'partial';
    paymentMethod: 'cash' | 'upi' | 'card';
    createdAt: string;
}

export interface Settings {
    id: string;
    salonId: string;
    openingTime: string;
    closingTime: string;
    workingDays: number[];
    gstPercentage: number;
    invoicePrefix: string;
    whatsappEnabled: boolean;
    whatsappNumber?: string;
}

// Helper functions
const generateId = () => crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

const getFromStorage = <T>(key: string): T[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const saveToStorage = <T>(key: string, data: T[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
};

const getObjectFromStorage = <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};

const saveObjectToStorage = <T>(key: string, data: T): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
};

// Database service
export const db = {
    // Auth - Hardened with strict session validation
    auth: {
        getCurrentUser: (): User | null => {
            return getObjectFromStorage<User>(STORAGE_KEYS.AUTH);
        },

        // Check if email is in admin whitelist
        isAdmin: (email: string): boolean => {
            return ADMIN_EMAILS.includes(email);
        },

        // Create a new session with expiry
        createSession: (userId: string, email: string, isAdmin: boolean): Session => {
            const now = new Date();
            const expiresAt = new Date(now.getTime() + config.sessionMaxAgeHours * 60 * 60 * 1000);

            const session: Session = {
                userId,
                email,
                isAdmin,
                loginTime: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                version: config.sessionVersion,
            };

            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
            }

            return session;
        },

        // Get current session (if valid)
        getSession: (): Session | null => {
            if (typeof window === 'undefined') return null;

            const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
            if (!sessionStr) return null;

            try {
                const session: Session = JSON.parse(sessionStr);
                return session;
            } catch {
                return null;
            }
        },

        // Validate session - checks expiry and version
        validateSession: (): { valid: boolean; reason?: string } => {
            if (typeof window === 'undefined') return { valid: false, reason: 'SSR' };

            const session = db.auth.getSession();
            if (!session) {
                return { valid: false, reason: 'No session found' };
            }

            // Check version - invalidate old sessions
            if (session.version !== config.sessionVersion) {
                db.auth.logout();
                return { valid: false, reason: 'Session version mismatch - please login again' };
            }

            // Check expiry
            const now = new Date();
            const expiresAt = new Date(session.expiresAt);
            if (now > expiresAt) {
                db.auth.logout();
                return { valid: false, reason: 'Session expired - please login again' };
            }

            // Verify user still exists
            const user = getObjectFromStorage<User>(STORAGE_KEYS.AUTH);
            if (!user || user.id !== session.userId) {
                db.auth.logout();
                return { valid: false, reason: 'User session invalid' };
            }

            return { valid: true };
        },

        login: (email: string, password: string): { success: boolean; message?: string; user?: User } => {
            // Clear any existing stale session first
            db.auth.logout();

            // Validate inputs strictly
            if (!email || !password) {
                return { success: false, message: 'Email and password are required' };
            }

            const trimmedEmail = email.trim().toLowerCase();
            const trimmedPassword = password.trim();

            if (!trimmedEmail || !trimmedPassword) {
                return { success: false, message: 'Email and password are required' };
            }

            // Check for admin credentials first
            if (trimmedEmail === ADMIN_CREDENTIALS.email && trimmedPassword === ADMIN_CREDENTIALS.password) {
                const adminUser: User = {
                    id: 'admin-001',
                    salonId: 'admin-salon',
                    email: ADMIN_CREDENTIALS.email,
                    name: ADMIN_CREDENTIALS.name,
                    password: ADMIN_CREDENTIALS.password,
                    role: 'owner',
                    createdAt: new Date().toISOString(),
                };

                // Save admin user
                saveObjectToStorage(STORAGE_KEYS.AUTH, adminUser);

                // Create proper session with expiry
                db.auth.createSession(adminUser.id, adminUser.email, true);

                // Mark onboarding complete for admin
                if (typeof window !== 'undefined') {
                    localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
                }

                console.log('[Auth] Admin login successful:', adminUser.email);
                return { success: true, user: adminUser };
            }

            const auth = getObjectFromStorage<User>(STORAGE_KEYS.AUTH);

            if (!auth) {
                return { success: false, message: 'No account found. Please create an account first.' };
            }

            if (auth.email.toLowerCase() !== trimmedEmail) {
                return { success: false, message: 'Invalid email address' };
            }

            if (auth.password !== trimmedPassword) {
                return { success: false, message: 'Incorrect password' };
            }

            // Check if onboarding is complete before allowing login
            if (!db.auth.isOnboardingComplete()) {
                return { success: false, message: 'Please complete onboarding first.' };
            }

            // Check if non-admin user - they need valid subscription
            if (!db.auth.isAdmin(trimmedEmail)) {
                const subscription = db.subscription.get();
                if (!subscription || subscription.status !== 'active') {
                    return { success: false, message: 'Your subscription has expired. Please subscribe to continue.' };
                }
            }

            // Create proper session with expiry
            db.auth.createSession(auth.id, auth.email, db.auth.isAdmin(trimmedEmail));

            console.log('[Auth] Login successful:', auth.email);
            return { success: true, user: auth };
        },

        logout: (): void => {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(STORAGE_KEYS.SESSION);
                // Also remove the old session key if it exists
                localStorage.removeItem('salonx_session');
                console.log('[Auth] Logged out');
            }
        },

        // Strict authentication check - validates session
        isAuthenticated: (): boolean => {
            const validation = db.auth.validateSession();
            return validation.valid;
        },

        isOnboardingComplete: (): boolean => {
            if (typeof window === 'undefined') return false;
            return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
        },

        // Get onboarding state
        getOnboardingState: (): OnboardingState | null => {
            return getObjectFromStorage<OnboardingState>(STORAGE_KEYS.ONBOARDING_STATE);
        },

        // Update onboarding state
        setOnboardingState: (state: OnboardingState): void => {
            saveObjectToStorage(STORAGE_KEYS.ONBOARDING_STATE, state);
        },

        // Check if current user can access dashboard (has valid subscription/trial or is admin)
        canAccessDashboard: (): { allowed: boolean; reason?: string; daysRemaining?: number } => {
            // First validate session
            const validation = db.auth.validateSession();
            if (!validation.valid) {
                return { allowed: false, reason: validation.reason };
            }

            // Then check onboarding
            if (!db.auth.isOnboardingComplete()) {
                return { allowed: false, reason: 'Onboarding not complete' };
            }

            const session = db.auth.getSession();
            if (!session) return { allowed: false, reason: 'No session' };

            // Admins always have access
            if (session.isAdmin) {
                return { allowed: true };
            }

            const subscription = db.subscription.get();
            if (!subscription) {
                return { allowed: false, reason: 'No subscription found' };
            }

            // Check subscription status
            if (subscription.status !== 'active') {
                return { allowed: false, reason: 'Subscription expired' };
            }

            // Check end date
            const endDate = new Date(subscription.endDate);
            const now = new Date();

            if (now > endDate) {
                // Update status
                db.subscription.updateStatus('expired');
                return { allowed: false, reason: 'Trial/subscription expired' };
            }

            // Calculate days remaining
            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            return { allowed: true, daysRemaining };
        },
    },

    // Subscription management
    subscription: {
        get: (): Subscription | null => {
            return getObjectFromStorage<Subscription>(STORAGE_KEYS.SUBSCRIPTION);
        },

        startTrial: (userId: string): Subscription => {
            const now = new Date();
            const endDate = new Date(now.getTime() + config.trialPeriodDays * 24 * 60 * 60 * 1000);

            const subscription: Subscription = {
                userId,
                plan: 'trial',
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                status: 'active',
            };

            saveObjectToStorage(STORAGE_KEYS.SUBSCRIPTION, subscription);
            return subscription;
        },

        subscribe: (userId: string, plan: 'core' | 'standard' | 'premium'): Subscription => {
            const now = new Date();
            // Set end date to 30 days from now (monthly subscription)
            const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

            const subscription: Subscription = {
                userId,
                plan,
                startDate: now.toISOString(),
                endDate: endDate.toISOString(),
                status: 'active',
            };

            saveObjectToStorage(STORAGE_KEYS.SUBSCRIPTION, subscription);
            return subscription;
        },

        updateStatus: (status: 'active' | 'expired' | 'cancelled'): void => {
            const subscription = getObjectFromStorage<Subscription>(STORAGE_KEYS.SUBSCRIPTION);
            if (subscription) {
                subscription.status = status;
                saveObjectToStorage(STORAGE_KEYS.SUBSCRIPTION, subscription);
            }
        },

        getTrialDaysRemaining: (): number => {
            const subscription = getObjectFromStorage<Subscription>(STORAGE_KEYS.SUBSCRIPTION);
            if (!subscription || subscription.plan !== 'trial') return 0;

            const endDate = new Date(subscription.endDate);
            const now = new Date();

            return Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        },
    },

    // Salon
    salon: {
        get: (): Salon | null => {
            return getObjectFromStorage<Salon>(STORAGE_KEYS.SALON);
        },

        create: (data: Omit<Salon, 'id' | 'createdAt'>): Salon => {
            const salon: Salon = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString(),
            };
            saveObjectToStorage(STORAGE_KEYS.SALON, salon);
            return salon;
        },

        update: (data: Partial<Salon>): Salon | null => {
            const salon = getObjectFromStorage<Salon>(STORAGE_KEYS.SALON);
            if (!salon) return null;
            const updated = { ...salon, ...data };
            saveObjectToStorage(STORAGE_KEYS.SALON, updated);
            return updated;
        },
    },

    // Customers
    customers: {
        getAll: (): Customer[] => {
            return getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
        },

        getById: (id: string): Customer | undefined => {
            const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
            return customers.find(c => c.id === id);
        },

        create: (data: Omit<Customer, 'id' | 'createdAt'>): Customer => {
            const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
            const customer: Customer = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString(),
            };
            customers.push(customer);
            saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
            return customer;
        },

        update: (id: string, data: Partial<Customer>): Customer | null => {
            const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
            const index = customers.findIndex(c => c.id === id);
            if (index === -1) return null;
            customers[index] = { ...customers[index], ...data };
            saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
            return customers[index];
        },

        delete: (id: string): boolean => {
            const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
            const filtered = customers.filter(c => c.id !== id);
            saveToStorage(STORAGE_KEYS.CUSTOMERS, filtered);
            return filtered.length < customers.length;
        },
    },

    // Staff
    staff: {
        getAll: (): Staff[] => {
            return getFromStorage<Staff>(STORAGE_KEYS.STAFF);
        },

        getById: (id: string): Staff | undefined => {
            const staff = getFromStorage<Staff>(STORAGE_KEYS.STAFF);
            return staff.find(s => s.id === id);
        },

        create: (data: Omit<Staff, 'id' | 'createdAt'>): Staff => {
            const staff = getFromStorage<Staff>(STORAGE_KEYS.STAFF);
            const newStaff: Staff = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString(),
            };
            staff.push(newStaff);
            saveToStorage(STORAGE_KEYS.STAFF, staff);
            return newStaff;
        },

        update: (id: string, data: Partial<Staff>): Staff | null => {
            const staff = getFromStorage<Staff>(STORAGE_KEYS.STAFF);
            const index = staff.findIndex(s => s.id === id);
            if (index === -1) return null;
            staff[index] = { ...staff[index], ...data };
            saveToStorage(STORAGE_KEYS.STAFF, staff);
            return staff[index];
        },

        delete: (id: string): boolean => {
            const staff = getFromStorage<Staff>(STORAGE_KEYS.STAFF);
            const filtered = staff.filter(s => s.id !== id);
            saveToStorage(STORAGE_KEYS.STAFF, filtered);
            return filtered.length < staff.length;
        },
    },

    // Services
    services: {
        getAll: (): Service[] => {
            return getFromStorage<Service>(STORAGE_KEYS.SERVICES);
        },

        getById: (id: string): Service | undefined => {
            const services = getFromStorage<Service>(STORAGE_KEYS.SERVICES);
            return services.find(s => s.id === id);
        },

        create: (data: Omit<Service, 'id'>): Service => {
            const services = getFromStorage<Service>(STORAGE_KEYS.SERVICES);
            const service: Service = {
                ...data,
                id: generateId(),
            };
            services.push(service);
            saveToStorage(STORAGE_KEYS.SERVICES, services);
            return service;
        },

        update: (id: string, data: Partial<Service>): Service | null => {
            const services = getFromStorage<Service>(STORAGE_KEYS.SERVICES);
            const index = services.findIndex(s => s.id === id);
            if (index === -1) return null;
            services[index] = { ...services[index], ...data };
            saveToStorage(STORAGE_KEYS.SERVICES, services);
            return services[index];
        },

        delete: (id: string): boolean => {
            const services = getFromStorage<Service>(STORAGE_KEYS.SERVICES);
            const filtered = services.filter(s => s.id !== id);
            saveToStorage(STORAGE_KEYS.SERVICES, filtered);
            return filtered.length < services.length;
        },
    },

    // Appointments
    appointments: {
        getAll: (): Appointment[] => {
            return getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
        },

        getById: (id: string): Appointment | undefined => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            return appointments.find(a => a.id === id);
        },

        getByDate: (date: string): Appointment[] => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            return appointments.filter(a => a.appointmentDate === date);
        },

        getByCustomer: (customerId: string): Appointment[] => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            return appointments.filter(a => a.customerId === customerId);
        },

        create: (data: Omit<Appointment, 'id' | 'createdAt'>): Appointment => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            const appointment: Appointment = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString(),
            };
            appointments.push(appointment);
            saveToStorage(STORAGE_KEYS.APPOINTMENTS, appointments);
            return appointment;
        },

        update: (id: string, data: Partial<Appointment>): Appointment | null => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            const index = appointments.findIndex(a => a.id === id);
            if (index === -1) return null;
            appointments[index] = { ...appointments[index], ...data };
            saveToStorage(STORAGE_KEYS.APPOINTMENTS, appointments);
            return appointments[index];
        },

        delete: (id: string): boolean => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            const filtered = appointments.filter(a => a.id !== id);
            saveToStorage(STORAGE_KEYS.APPOINTMENTS, filtered);
            return filtered.length < appointments.length;
        },
    },

    // Bills
    bills: {
        getAll: (): Bill[] => {
            return getFromStorage<Bill>(STORAGE_KEYS.BILLS);
        },

        getById: (id: string): Bill | undefined => {
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            return bills.find(b => b.id === id);
        },

        getByCustomer: (customerId: string): Bill[] => {
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            return bills.filter(b => b.customerId === customerId);
        },

        create: (data: Omit<Bill, 'id' | 'createdAt'>): Bill => {
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            const bill: Bill = {
                ...data,
                id: generateId(),
                createdAt: new Date().toISOString(),
            };
            bills.push(bill);
            saveToStorage(STORAGE_KEYS.BILLS, bills);
            return bill;
        },

        getTodayRevenue: (): number => {
            const today = new Date().toISOString().split('T')[0];
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            return bills
                .filter(b => b.createdAt.startsWith(today) && b.paymentStatus === 'paid')
                .reduce((sum, b) => sum + b.finalAmount, 0);
        },

        getWeekRevenue: (): number => {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            return bills
                .filter(b => new Date(b.createdAt) >= weekAgo && b.paymentStatus === 'paid')
                .reduce((sum, b) => sum + b.finalAmount, 0);
        },

        getMonthRevenue: (): number => {
            const now = new Date();
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            return bills
                .filter(b => new Date(b.createdAt) >= monthAgo && b.paymentStatus === 'paid')
                .reduce((sum, b) => sum + b.finalAmount, 0);
        },
    },

    // Settings
    settings: {
        get: (): Settings | null => {
            return getObjectFromStorage<Settings>(STORAGE_KEYS.SETTINGS);
        },

        save: (data: Settings): Settings => {
            saveObjectToStorage(STORAGE_KEYS.SETTINGS, data);
            return data;
        },
    },

    // Complete onboarding (only for admin/developer users)
    completeOnboarding: (
        salon: Omit<Salon, 'id' | 'createdAt'>,
        admin: { name: string; email: string; password: string },
        settings: Omit<Settings, 'id' | 'salonId'>
    ): { salon: Salon; user: User } => {
        const isAdmin = db.auth.isAdmin(admin.email);

        console.log('[Onboarding] Completing onboarding for:', admin.email, 'isAdmin:', isAdmin);

        // Create salon
        const createdSalon = db.salon.create(salon);

        // Create admin user
        const user: User = {
            id: generateId(),
            salonId: createdSalon.id,
            email: admin.email,
            name: admin.name,
            password: admin.password, // In production, hash this
            role: 'owner',
            createdAt: new Date().toISOString(),
        };
        saveObjectToStorage(STORAGE_KEYS.AUTH, user);

        // Auto-login: Create proper session with expiry
        db.auth.createSession(user.id, user.email, isAdmin);

        // Start 14-day trial (admins always get trial for testing purposes)
        if (isAdmin) {
            db.subscription.startTrial(user.id);
        }

        // Save settings
        const fullSettings: Settings = {
            ...settings,
            id: generateId(),
            salonId: createdSalon.id,
        };
        db.settings.save(fullSettings);

        // Mark onboarding complete
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        }

        // Update onboarding state
        db.auth.setOnboardingState({
            status: 'completed',
            currentStep: 7,
            lastUpdated: new Date().toISOString(),
            salonId: createdSalon.id,
        });

        console.log('[Onboarding] Completed successfully for salon:', createdSalon.id);
        return { salon: createdSalon, user };
    },

    // Reset all data
    resetAll: (): void => {
        if (typeof window === 'undefined') return;
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },
};
