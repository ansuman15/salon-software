/**
 * Supabase Client Library
 * Handles authentication and database operations
 */

import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

// Types
export interface DbUser {
    id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'staff';
    salon_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DbSalon {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string;
    phone: string;
    email: string | null;
    logo_url: string | null;
    owner_id: string;
    business_type: string | null;
    opening_time: string;
    closing_time: string;
    working_days: string[];
    created_at: string;
    updated_at: string;
}

export interface DbStaff {
    id: string;
    salon_id: string;
    user_id: string | null;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    aadhar: string | null;
    joining_date: string;
    is_active: boolean;
    service_ids: string[];
    created_at: string;
    updated_at: string;
}

export interface DbService {
    id: string;
    salon_id: string;
    name: string;
    category: string;
    price: number;
    duration_minutes: number;
    is_active: boolean;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbCustomer {
    id: string;
    salon_id: string;
    name: string;
    phone: string;
    email: string | null;
    gender: 'male' | 'female' | 'other' | null;
    date_of_birth: string | null;
    notes: string | null;
    tags: string[];
    total_visits: number;
    total_spent: number;
    last_visit_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbAppointment {
    id: string;
    salon_id: string;
    customer_id: string;
    staff_id: string;
    service_ids: string[];
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
    notes: string | null;
    total_amount: number | null;
    cancellation_reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbPayment {
    id: string;
    salon_id: string;
    customer_id: string | null;
    appointment_id: string | null;
    amount: number;
    payment_method: 'cash' | 'card' | 'upi' | 'other';
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    razorpay_signature: string | null;
    notes: string | null;
    created_at: string;
}

export interface DbSubscription {
    id: string;
    salon_id: string;
    plan: 'trial' | 'core' | 'standard' | 'premium';
    status: 'active' | 'expired' | 'cancelled' | 'past_due';
    start_date: string;
    end_date: string | null;
    trial_days_used: number;
    amount_paid: number;
    razorpay_subscription_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface DbAttendance {
    id: string;
    salon_id: string;
    staff_id: string;
    attendance_date: string; // YYYY-MM-DD
    status: 'present' | 'absent' | 'half_day' | 'leave';
    check_in_time: string | null;
    check_out_time: string | null;
    notes: string | null;
    is_locked?: boolean;
    admin_override?: boolean;
    created_at: string;
    updated_at: string;
}

export interface DbProduct {
    id: string;
    salon_id: string;
    name: string;
    category: string | null;
    brand: string | null;
    type: 'service_use' | 'retail_sale' | 'both';
    unit: string;
    cost_price: number | null;
    selling_price: number | null;
    image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DbSupplier {
    id: string;
    salon_id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DbInventory {
    id: string;
    salon_id: string;
    product_id: string;
    quantity: number;
    reorder_level: number;
    updated_at: string;
}

export interface DbStockMovement {
    id: string;
    salon_id: string;
    product_id: string;
    supplier_id: string | null;
    movement_type: 'purchase' | 'billing_deduction' | 'manual_adjustment' | 'correction' | 'return';
    quantity_change: number;
    quantity_before: number | null;
    quantity_after: number | null;
    reference_type: string | null;
    reference_id: string | null;
    reason: string | null;
    performed_by: string | null;
    created_at: string;
}

export interface DbBillingItem {
    id: string;
    salon_id: string;
    product_id: string;
    billing_id: string | null;
    quantity_used: number;
    unit_price: number | null;
    total_price: number | null;
    created_at: string;
}

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client
 */
export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) return supabaseClient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }

    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
        },
    });

    return supabaseClient;
}

/**
 * Get Supabase client for server-side operations (with service role)
 */
export function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    }
    if (!supabaseServiceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// ============================================
// AUTH OPERATIONS
// ============================================

export const supabaseAuth = {
    /**
     * Sign up a new user
     */
    async signUp(email: string, password: string, name: string) {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });

        if (error) throw error;

        // Create user profile
        if (data.user) {
            await supabase.from('users').insert({
                id: data.user.id,
                email: data.user.email,
                name,
                role: 'owner',
            });
        }

        return data;
    },

    /**
     * Sign in with email/password
     */
    async signIn(email: string, password: string) {
        const supabase = getSupabaseClient();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        return data;
    },

    /**
     * Sign out
     */
    async signOut() {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    /**
     * Get current session
     */
    async getSession() {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    /**
     * Get current user
     */
    async getUser(): Promise<SupabaseUser | null> {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) return null;
        return data.user;
    },

    /**
     * Get user profile from database
     */
    async getUserProfile(): Promise<DbUser | null> {
        const supabase = getSupabaseClient();
        const user = await this.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) return null;
        return data;
    },

    /**
     * Reset password
     */
    async resetPassword(email: string) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
    },
};

// ============================================
// DATABASE OPERATIONS
// ============================================

export const supabaseDb = {
    // SALONS
    salons: {
        async get(): Promise<DbSalon | null> {
            const supabase = getSupabaseClient();
            const profile = await supabaseAuth.getUserProfile();
            if (!profile?.salon_id) return null;

            const { data, error } = await supabase
                .from('salons')
                .select('*')
                .eq('id', profile.salon_id)
                .single();

            if (error) return null;
            return data;
        },

        async create(salon: Partial<DbSalon>): Promise<DbSalon> {
            const supabase = getSupabaseClient();
            const user = await supabaseAuth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { data, error } = await supabase
                .from('salons')
                .insert({ ...salon, owner_id: user.id })
                .select()
                .single();

            if (error) throw error;

            // Update user with salon_id
            await supabase
                .from('users')
                .update({ salon_id: data.id })
                .eq('id', user.id);

            return data;
        },

        async update(id: string, updates: Partial<DbSalon>): Promise<DbSalon> {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('salons')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
    },

    // STAFF
    staff: {
        async getAll(): Promise<DbStaff[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('staff')
                .select('*')
                .eq('salon_id', salon.id)
                .order('created_at', { ascending: false });

            if (error) return [];
            return data;
        },

        async create(staff: Partial<DbStaff>): Promise<DbStaff> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('staff')
                .insert({ ...staff, salon_id: salon.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async update(id: string, updates: Partial<DbStaff>): Promise<DbStaff> {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('staff')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async delete(id: string): Promise<void> {
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('staff')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
    },

    // SERVICES
    services: {
        async getAll(): Promise<DbService[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('salon_id', salon.id)
                .order('category', { ascending: true });

            if (error) return [];
            return data;
        },

        async create(service: Partial<DbService>): Promise<DbService> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('services')
                .insert({ ...service, salon_id: salon.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async update(id: string, updates: Partial<DbService>): Promise<DbService> {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('services')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async delete(id: string): Promise<void> {
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
    },

    // CUSTOMERS
    customers: {
        async getAll(): Promise<DbCustomer[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('salon_id', salon.id)
                .order('name', { ascending: true });

            if (error) return [];
            return data;
        },

        async create(customer: Partial<DbCustomer>): Promise<DbCustomer> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('customers')
                .insert({ ...customer, salon_id: salon.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async update(id: string, updates: Partial<DbCustomer>): Promise<DbCustomer> {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('customers')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async delete(id: string): Promise<void> {
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('customers')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
    },

    // APPOINTMENTS
    appointments: {
        async getAll(): Promise<DbAppointment[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('salon_id', salon.id)
                .order('appointment_date', { ascending: false });

            if (error) return [];
            return data;
        },

        async getByDate(date: string): Promise<DbAppointment[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('appointments')
                .select('*')
                .eq('salon_id', salon.id)
                .eq('appointment_date', date)
                .order('start_time', { ascending: true });

            if (error) return [];
            return data;
        },

        async create(appointment: Partial<DbAppointment>): Promise<DbAppointment> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('appointments')
                .insert({ ...appointment, salon_id: salon.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async update(id: string, updates: Partial<DbAppointment>): Promise<DbAppointment> {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async delete(id: string): Promise<void> {
            const supabase = getSupabaseClient();
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
    },

    // PAYMENTS
    payments: {
        async getAll(): Promise<DbPayment[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('payments')
                .select('*')
                .eq('salon_id', salon.id)
                .order('created_at', { ascending: false });

            if (error) return [];
            return data;
        },

        async create(payment: Partial<DbPayment>): Promise<DbPayment> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('payments')
                .insert({ ...payment, salon_id: salon.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
    },

    // SUBSCRIPTIONS
    subscriptions: {
        async get(): Promise<DbSubscription | null> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return null;

            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('salon_id', salon.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) return null;
            return data;
        },

        async create(subscription: Partial<DbSubscription>): Promise<DbSubscription> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('subscriptions')
                .insert({ ...subscription, salon_id: salon.id })
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        async update(id: string, updates: Partial<DbSubscription>): Promise<DbSubscription> {
            const supabase = getSupabaseClient();
            const { data, error } = await supabase
                .from('subscriptions')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
    },

    // ATTENDANCE
    attendance: {
        /**
         * Get all attendance records for a specific date
         */
        async getByDate(date: string): Promise<DbAttendance[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('salon_id', salon.id)
                .eq('attendance_date', date)
                .order('created_at', { ascending: true });

            if (error) return [];
            return data;
        },

        /**
         * Get attendance for a staff member within a date range (for reports)
         */
        async getByStaffRange(staffId: string, startDate: string, endDate: string): Promise<DbAttendance[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) return [];

            const { data, error } = await supabase
                .from('attendance')
                .select('*')
                .eq('salon_id', salon.id)
                .eq('staff_id', staffId)
                .gte('attendance_date', startDate)
                .lte('attendance_date', endDate)
                .order('attendance_date', { ascending: true });

            if (error) return [];
            return data;
        },

        /**
         * Upsert a single attendance record (idempotent)
         * Uses Postgres ON CONFLICT to safely handle duplicates
         */
        async upsert(record: Omit<DbAttendance, 'id' | 'created_at' | 'updated_at'>): Promise<DbAttendance> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const { data, error } = await supabase
                .from('attendance')
                .upsert(
                    { ...record, salon_id: salon.id },
                    { onConflict: 'staff_id,attendance_date' }
                )
                .select()
                .single();

            if (error) throw error;
            return data;
        },

        /**
         * Upsert multiple attendance records in a single transaction
         * Safe to call multiple times (idempotent)
         */
        async upsertBatch(records: Array<Omit<DbAttendance, 'id' | 'salon_id' | 'created_at' | 'updated_at'>>): Promise<DbAttendance[]> {
            const supabase = getSupabaseClient();
            const salon = await supabaseDb.salons.get();
            if (!salon) throw new Error('No salon found');

            const recordsWithSalon = records.map(r => ({
                ...r,
                salon_id: salon.id,
            }));

            const { data, error } = await supabase
                .from('attendance')
                .upsert(recordsWithSalon, { onConflict: 'staff_id,attendance_date' })
                .select();

            if (error) throw error;
            return data;
        },

        /**
         * Get monthly summary for a staff member
         */
        async getMonthlySummary(staffId: string, year: number, month: number): Promise<{
            present: number;
            absent: number;
            half_day: number;
            leave: number;
        }> {
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            const records = await this.getByStaffRange(staffId, startDate, endDate);

            return {
                present: records.filter(r => r.status === 'present').length,
                absent: records.filter(r => r.status === 'absent').length,
                half_day: records.filter(r => r.status === 'half_day').length,
                leave: records.filter(r => r.status === 'leave').length,
            };
        },
    },
};

export default { auth: supabaseAuth, db: supabaseDb };

