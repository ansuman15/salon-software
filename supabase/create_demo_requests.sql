-- ============================================
-- Migration: Create demo_requests table
-- Run this in Supabase SQL Editor
-- ============================================

-- Create demo_requests table for storing landing page form submissions
CREATE TABLE IF NOT EXISTS public.demo_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    salon_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT,
    staff_count TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'converted', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_demo_requests_status ON public.demo_requests(status);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created ON public.demo_requests(created_at DESC);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_demo_requests_updated_at ON public.demo_requests;
CREATE TRIGGER update_demo_requests_updated_at 
    BEFORE UPDATE ON public.demo_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Disable RLS for demo_requests (public form submission)
-- The table is write-only for public users
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for landing page form)
CREATE POLICY "Allow public demo request inserts" ON public.demo_requests
    FOR INSERT WITH CHECK (true);

-- Only allow authenticated admin users to view/update demo requests
-- Note: This requires proper admin authentication setup
CREATE POLICY "Admin can view demo requests" ON public.demo_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "Admin can update demo requests" ON public.demo_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

-- Verify table was created
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'demo_requests'
ORDER BY ordinal_position;
