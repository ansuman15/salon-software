-- ============================================
-- CLEAR ALL TEST DATA FROM SALONX
-- Run this in Supabase SQL Editor
-- ============================================

-- WARNING: This deletes ALL data! Only run on test/dev databases.

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Clear auth/admin tables
TRUNCATE TABLE public.admin_audit_logs CASCADE;
TRUNCATE TABLE public.activation_keys CASCADE;
TRUNCATE TABLE public.leads CASCADE;

-- Clear salon data tables (order matters due to foreign keys)
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.appointments CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.services CASCADE;
TRUNCATE TABLE public.staff CASCADE;
TRUNCATE TABLE public.subscriptions CASCADE;
TRUNCATE TABLE public.salons CASCADE;
TRUNCATE TABLE public.users CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Verify tables are empty
SELECT 'salons' as table_name, COUNT(*) as count FROM public.salons
UNION ALL SELECT 'users', COUNT(*) FROM public.users
UNION ALL SELECT 'staff', COUNT(*) FROM public.staff
UNION ALL SELECT 'services', COUNT(*) FROM public.services
UNION ALL SELECT 'customers', COUNT(*) FROM public.customers
UNION ALL SELECT 'appointments', COUNT(*) FROM public.appointments
UNION ALL SELECT 'payments', COUNT(*) FROM public.payments
UNION ALL SELECT 'subscriptions', COUNT(*) FROM public.subscriptions
UNION ALL SELECT 'leads', COUNT(*) FROM public.leads
UNION ALL SELECT 'admin_audit_logs', COUNT(*) FROM public.admin_audit_logs
UNION ALL SELECT 'activation_keys', COUNT(*) FROM public.activation_keys;
-- All counts should be 0
