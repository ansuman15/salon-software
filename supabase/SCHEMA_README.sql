-- ============================================
-- SalonX Master Schema
-- Run this file to set up a fresh database
-- ============================================

-- NOTE: Run these files in order in Supabase SQL Editor:
-- 1. database.sql (core tables: users, salons, staff, services, customers, appointments, payments)
-- 2. auth_schema.sql (activation_keys table)
-- 3. attendance_migration.sql (attendance, attendance_audit_log)
-- 4. inventory_schema.sql (products, inventory, suppliers, stock_movements, billing_items)
-- 5. billing_schema.sql (coupons, bills, bill_items)

-- This file is a reference listing all tables in the system.
-- For production, run each individual schema file.

-- ============================================
-- TABLE SUMMARY
-- ============================================

/*
CORE TABLES (database.sql):
- public.users
- public.salons
- public.staff
- public.services
- public.customers
- public.appointments
- public.payments
- public.subscriptions

AUTH TABLES (auth_schema.sql):
- public.activation_keys

ATTENDANCE TABLES (attendance_migration.sql):
- public.attendance
- public.attendance_audit_log

INVENTORY TABLES (inventory_schema.sql):
- public.products
- public.inventory
- public.suppliers
- public.stock_movements
- public.billing_items

BILLING TABLES (billing_schema.sql):
- public.coupons
- public.bills
- public.bill_items
*/

-- ============================================
-- QUICK VERIFICATION QUERY
-- Run this after setting up to verify all tables exist
-- ============================================

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
