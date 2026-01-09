-- ============================================
-- Migration: Add missing columns to staff and services
-- Run this in Supabase SQL Editor
-- ============================================

-- Add image_url column to staff table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff' AND column_name = 'image_url') THEN
        ALTER TABLE public.staff ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Add email column to staff table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff' AND column_name = 'email') THEN
        ALTER TABLE public.staff ADD COLUMN email TEXT;
    END IF;
END $$;

-- Add aadhar column to staff table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff' AND column_name = 'aadhar') THEN
        ALTER TABLE public.staff ADD COLUMN aadhar TEXT;
    END IF;
END $$;

-- Add joining_date column to staff table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'staff' AND column_name = 'joining_date') THEN
        ALTER TABLE public.staff ADD COLUMN joining_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Add image_url column to services table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' AND column_name = 'image_url') THEN
        ALTER TABLE public.services ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Verify columns were added
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff' 
AND column_name IN ('image_url', 'email', 'aadhar', 'joining_date')
ORDER BY table_name, column_name;
