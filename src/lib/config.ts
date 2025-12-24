// Environment configuration for SalonX
// For local development, we'll use localStorage as a mock database
// In production, these would point to Supabase

export const config = {
    // Database mode: 'local' uses localStorage, 'supabase' uses real DB
    databaseMode: process.env.NEXT_PUBLIC_DB_MODE || 'local',

    // Supabase config (for production)
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

    // Trial period in days
    trialPeriodDays: 14,
};

// Admin/Developer whitelist - these emails can bypass trial restrictions
export const ADMIN_EMAILS = [
    'admin@salonx.in',
    'developer@salonx.in',
];

// Pre-configured admin account for testing
export const ADMIN_CREDENTIALS = {
    email: 'admin@salonx.in',
    password: 'SalonX@2024',
    name: 'SalonX Admin',
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
    SUBSCRIPTION: 'salonx_subscription',
    ONBOARDING_COMPLETE: 'salonx_onboarding_complete',
};
