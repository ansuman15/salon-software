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

-- Add image_url column to services table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'services' AND column_name = 'image_url') THEN
        ALTER TABLE public.services ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('staff', 'services') 
AND column_name = 'image_url';
