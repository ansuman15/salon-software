// Environment configuration for SalonX
// For local development, we'll use localStorage as a mock database
// In production, these would point to Supabase

export const config = {
    // Database mode: 'local' uses localStorage, 'supabase' uses real DB
    databaseMode: process.env.NEXT_PUBLIC_DB_MODE || 'local',

    // Supabase config (for production)
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};

// Local storage keys
export const STORAGE_KEYS = {
    SALON: 'salonx_salon',
    CUSTOMERS: 'salonx_customers',
    STAFF: 'salonx_staff',
    SERVICES: 'salonx_services',
    APPOINTMENTS: 'salonx_appointments',
    BILLS: 'salonx_bills',
    SETTINGS: 'salonx_settings',
    AUTH: 'salonx_auth',
    ONBOARDING_COMPLETE: 'salonx_onboarding_complete',
};
