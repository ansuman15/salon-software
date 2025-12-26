// Local Database Service using localStorage
// Simplified for activation key auth model (no trial/onboarding)

import { STORAGE_KEYS, ADMIN_EMAILS, ADMIN_CREDENTIALS, config } from './config';

// Types
export interface Session {
    salonId: string;
    email: string;
    name: string;
    isAdmin: boolean;
    loginTime: string;
    expiresAt: string;
}

export interface Salon {
    id: string;
    name: string;
    ownerEmail: string;
    phone: string;
    city: string;
    address?: string;
    currency?: string;
    logoUrl?: string;
    businessType?: string;
    timezone?: string;
    status: 'inactive' | 'active' | 'suspended';
    activatedAt?: string;
    lastLoginAt?: string;
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
    imageUrl?: string;
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

// User interface (for backward compatibility)
export interface User {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'admin' | 'staff';
    salonId: string;
    createdAt: string;
}

// Subscription interface (stub for backward compatibility)
export interface Subscription {
    plan: 'trial' | 'core' | 'standard' | 'premium';
    status: 'active' | 'expired' | 'cancelled';
    startDate: string;
    endDate?: string;
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
    // Auth - Simplified for activation key model
    auth: {
        // Check if email is in admin whitelist
        isAdmin: (email: string): boolean => {
            return ADMIN_EMAILS.includes(email);
        },

        // Get current session from localStorage (UI state backup)
        getSession: (): Session | null => {
            if (typeof window === 'undefined') return null;
            const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
            if (!sessionStr) return null;
            try {
                return JSON.parse(sessionStr);
            } catch {
                return null;
            }
        },

        // Validate session
        validateSession: (): { valid: boolean; reason?: string } => {
            const session = db.auth.getSession();
            if (!session) {
                return { valid: false, reason: 'No session found' };
            }

            // Check expiry
            if (new Date(session.expiresAt) < new Date()) {
                db.auth.logout();
                return { valid: false, reason: 'Session expired' };
            }

            return { valid: true };
        },

        // Check if authenticated
        isAuthenticated: (): boolean => {
            return db.auth.validateSession().valid;
        },

        // Logout
        logout: (): void => {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(STORAGE_KEYS.SESSION);
                // Clear old session keys too
                localStorage.removeItem('salonx_session');
                localStorage.removeItem('salonx_auth');
                localStorage.removeItem('salonx_onboarding_complete');
                localStorage.removeItem('salonx_onboarding_state');
                localStorage.removeItem('salonx_subscription');
            }
        },

        // Simple dashboard access check (no trial logic)
        canAccessDashboard: (): { allowed: boolean; reason?: string } => {
            const validation = db.auth.validateSession();
            if (!validation.valid) {
                return { allowed: false, reason: validation.reason };
            }
            return { allowed: true };
        },

        // Admin login (for local dev/testing only)
        loginAsAdmin: (email: string, password: string): { success: boolean; message?: string } => {
            if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
                const session: Session = {
                    salonId: 'admin-salon',
                    email: ADMIN_CREDENTIALS.email,
                    name: ADMIN_CREDENTIALS.name,
                    isAdmin: true,
                    loginTime: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + config.sessionMaxAgeHours * 60 * 60 * 1000).toISOString(),
                };
                saveObjectToStorage(STORAGE_KEYS.SESSION, session);
                return { success: true };
            }
            return { success: false, message: 'Invalid credentials' };
        },

        // Get current user (derived from session, for backward compatibility)
        getCurrentUser: (): User | null => {
            const session = db.auth.getSession();
            if (!session) return null;
            return {
                id: session.salonId,
                name: session.name,
                email: session.email,
                role: session.isAdmin ? 'admin' : 'owner',
                salonId: session.salonId,
                createdAt: session.loginTime,
            };
        },
    },

    // Subscription (stub for backward compatibility)
    subscription: {
        get: (): Subscription | null => {
            // In the new model, all active salons have access
            // This is a stub to prevent profile page errors
            return {
                plan: 'standard',
                status: 'active',
                startDate: new Date().toISOString(),
            };
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
        getAll: (): Customer[] => getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS),
        getById: (id: string): Customer | undefined => {
            return getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS).find(c => c.id === id);
        },
        create: (data: Omit<Customer, 'id' | 'createdAt'>): Customer => {
            const customers = getFromStorage<Customer>(STORAGE_KEYS.CUSTOMERS);
            const customer: Customer = { ...data, id: generateId(), createdAt: new Date().toISOString() };
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
        getAll: (): Staff[] => getFromStorage<Staff>(STORAGE_KEYS.STAFF),
        getById: (id: string): Staff | undefined => {
            return getFromStorage<Staff>(STORAGE_KEYS.STAFF).find(s => s.id === id);
        },
        create: (data: Omit<Staff, 'id' | 'createdAt'>): Staff => {
            const staff = getFromStorage<Staff>(STORAGE_KEYS.STAFF);
            const newStaff: Staff = { ...data, id: generateId(), createdAt: new Date().toISOString() };
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
        getAll: (): Service[] => getFromStorage<Service>(STORAGE_KEYS.SERVICES),
        getById: (id: string): Service | undefined => {
            return getFromStorage<Service>(STORAGE_KEYS.SERVICES).find(s => s.id === id);
        },
        create: (data: Omit<Service, 'id'>): Service => {
            const services = getFromStorage<Service>(STORAGE_KEYS.SERVICES);
            const service: Service = { ...data, id: generateId() };
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
        getAll: (): Appointment[] => getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS),
        getById: (id: string): Appointment | undefined => {
            return getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS).find(a => a.id === id);
        },
        getByDate: (date: string): Appointment[] => {
            return getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS).filter(a => a.appointmentDate === date);
        },
        getByCustomer: (customerId: string): Appointment[] => {
            return getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS).filter(a => a.customerId === customerId);
        },
        create: (data: Omit<Appointment, 'id' | 'createdAt'>): Appointment => {
            const appointments = getFromStorage<Appointment>(STORAGE_KEYS.APPOINTMENTS);
            const appointment: Appointment = { ...data, id: generateId(), createdAt: new Date().toISOString() };
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
        getAll: (): Bill[] => getFromStorage<Bill>(STORAGE_KEYS.BILLS),
        getById: (id: string): Bill | undefined => {
            return getFromStorage<Bill>(STORAGE_KEYS.BILLS).find(b => b.id === id);
        },
        getByCustomer: (customerId: string): Bill[] => {
            return getFromStorage<Bill>(STORAGE_KEYS.BILLS).filter(b => b.customerId === customerId);
        },
        create: (data: Omit<Bill, 'id' | 'createdAt'>): Bill => {
            const bills = getFromStorage<Bill>(STORAGE_KEYS.BILLS);
            const bill: Bill = { ...data, id: generateId(), createdAt: new Date().toISOString() };
            bills.push(bill);
            saveToStorage(STORAGE_KEYS.BILLS, bills);
            return bill;
        },
        getTodayRevenue: (): number => {
            const today = new Date().toISOString().split('T')[0];
            return getFromStorage<Bill>(STORAGE_KEYS.BILLS)
                .filter(b => b.createdAt.startsWith(today) && b.paymentStatus === 'paid')
                .reduce((sum, b) => sum + b.finalAmount, 0);
        },
        getWeekRevenue: (): number => {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return getFromStorage<Bill>(STORAGE_KEYS.BILLS)
                .filter(b => new Date(b.createdAt) >= weekAgo && b.paymentStatus === 'paid')
                .reduce((sum, b) => sum + b.finalAmount, 0);
        },
        getMonthRevenue: (): number => {
            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            return getFromStorage<Bill>(STORAGE_KEYS.BILLS)
                .filter(b => new Date(b.createdAt) >= monthAgo && b.paymentStatus === 'paid')
                .reduce((sum, b) => sum + b.finalAmount, 0);
        },
    },

    // Settings
    settings: {
        get: (): Settings | null => getObjectFromStorage<Settings>(STORAGE_KEYS.SETTINGS),
        save: (data: Settings): Settings => {
            saveObjectToStorage(STORAGE_KEYS.SETTINGS, data);
            return data;
        },
    },

    // Reset all data
    resetAll: (): void => {
        if (typeof window === 'undefined') return;
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },
};
