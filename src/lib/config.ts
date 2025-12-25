// Environment configuration for SalonX
// Admin-controlled activation key authentication

export const config = {
    // Database mode: 'local' uses localStorage, 'supabase' uses real DB
    databaseMode: process.env.NEXT_PUBLIC_DB_MODE || 'local',

    // Supabase config (for production)
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',

    // Session configuration
    sessionMaxAgeHours: 24, // Session expires after 24 hours
    sessionVersion: '2.0.0', // Bumped to invalidate old sessions (v1 had trial logic)

    // Activation key settings
    activationKeyExpiryHours: 72, // Default key expiry
};

// Admin/Developer whitelist - these emails can access admin panel
export const ADMIN_EMAILS = [
    'admin@salonx.in',
    'developer@salonx.in',
];

// Pre-configured admin account for testing (admin panel only)
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
    // Auth keys (simplified - no onboarding/trial)
    SESSION: 'salonx_session_v2',
};
