// Local Database Service using localStorage
// This provides a consistent API that can be swapped for Supabase in production

import { STORAGE_KEYS } from './config';

// Types
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
    // Auth
    auth: {
        getCurrentUser: (): User | null => {
            return getObjectFromStorage<User>(STORAGE_KEYS.AUTH);
        },

        login: (email: string, password: string): User | null => {
            const salon = getObjectFromStorage<Salon>(STORAGE_KEYS.SALON);
            if (!salon) return null;

            const auth = getObjectFromStorage<User>(STORAGE_KEYS.AUTH);
            if (auth && auth.email === email && auth.password === password) {
                return auth;
            }
            return null;
        },

        logout: (): void => {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(STORAGE_KEYS.AUTH);
            }
        },

        isOnboardingComplete: (): boolean => {
            if (typeof window === 'undefined') return false;
            return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
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

    // Complete onboarding
    completeOnboarding: (
        salon: Omit<Salon, 'id' | 'createdAt'>,
        admin: { name: string; email: string; password: string },
        settings: Omit<Settings, 'id' | 'salonId'>
    ): { salon: Salon; user: User } => {
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
