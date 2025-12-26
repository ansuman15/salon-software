-- ============================================
-- SalonX Attendance Schema - Safe Migration
-- Run this if you already have an attendance table
-- ============================================

-- Step 1: Drop existing objects safely
DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
DROP FUNCTION IF EXISTS upsert_attendance;
DROP FUNCTION IF EXISTS get_attendance_summary;
DROP FUNCTION IF EXISTS lock_attendance_for_payroll;
DROP TABLE IF EXISTS public.attendance_audit_log;
DROP TABLE IF EXISTS public.attendance;

-- Step 2: Create fresh attendance table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    salon_id UUID NOT NULL
        REFERENCES public.salons(id)
        ON DELETE CASCADE,
    
    staff_id UUID NOT NULL
        REFERENCES public.staff(id)
        ON DELETE CASCADE,
    
    attendance_date DATE NOT NULL,
    
    status TEXT NOT NULL
        CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
    
    check_in_time TIME,
    check_out_time TIME,
    
    notes TEXT,
    
    -- Payroll lock flag
    is_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES public.users(id),
    
    -- Admin override tracking
    last_modified_by UUID REFERENCES public.users(id),
    admin_override BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One record per staff per date
    UNIQUE (staff_id, attendance_date)
);

-- Step 3: Indexes
CREATE INDEX idx_attendance_salon ON public.attendance(salon_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX idx_attendance_staff ON public.attendance(staff_id);
CREATE INDEX idx_attendance_salon_date ON public.attendance(salon_id, attendance_date);

-- Step 4: RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (in case they exist)
DROP POLICY IF EXISTS "Salon can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Salon owner can manage own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admin full access to attendance" ON public.attendance;
DROP POLICY IF EXISTS "Attendance visible to salon" ON public.attendance;
DROP POLICY IF EXISTS "Attendance editable by salon owner" ON public.attendance;

-- Create policies
CREATE POLICY "Salon can view own attendance" 
ON public.attendance FOR SELECT
USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage own attendance"
ON public.attendance FOR ALL
USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()))
WITH CHECK (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

CREATE POLICY "Admin full access to attendance"
ON public.attendance FOR ALL
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Step 5: Updated_at trigger
CREATE TRIGGER update_attendance_updated_at 
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Step 6: Summary function for payroll
CREATE OR REPLACE FUNCTION get_attendance_summary(
    p_salon_id UUID,
    p_staff_id UUID,
    p_year INTEGER,
    p_month INTEGER
)
RETURNS TABLE (
    staff_id UUID,
    total_present_days INTEGER,
    total_half_days INTEGER,
    total_absent_days INTEGER,
    total_leave_days INTEGER,
    total_working_hours INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.staff_id,
        COUNT(*) FILTER (WHERE a.status = 'present')::INTEGER,
        COUNT(*) FILTER (WHERE a.status = 'half_day')::INTEGER,
        COUNT(*) FILTER (WHERE a.status = 'absent')::INTEGER,
        COUNT(*) FILTER (WHERE a.status = 'leave')::INTEGER,
        COALESCE(
            SUM(
                CASE 
                    WHEN a.check_out_time IS NOT NULL AND a.check_in_time IS NOT NULL 
                    THEN a.check_out_time - a.check_in_time 
                    ELSE INTERVAL '0 hours'
                END
            ),
            INTERVAL '0 hours'
        )
    FROM public.attendance a
    WHERE a.salon_id = p_salon_id
      AND a.staff_id = p_staff_id
      AND EXTRACT(YEAR FROM a.attendance_date) = p_year
      AND EXTRACT(MONTH FROM a.attendance_date) = p_month
    GROUP BY a.staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Lock function for payroll
CREATE OR REPLACE FUNCTION lock_attendance_for_payroll(
    p_salon_id UUID,
    p_year INTEGER,
    p_month INTEGER,
    p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.attendance
    SET 
        is_locked = TRUE,
        locked_at = NOW(),
        locked_by = p_user_id
    WHERE salon_id = p_salon_id
      AND EXTRACT(YEAR FROM attendance_date) = p_year
      AND EXTRACT(MONTH FROM attendance_date) = p_month
      AND is_locked = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Audit log table
CREATE TABLE public.attendance_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE SET NULL,
    salon_id UUID NOT NULL,
    staff_id UUID NOT NULL,
    attendance_date DATE NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'admin_override', 'lock', 'unlock')),
    old_status TEXT,
    new_status TEXT,
    performed_by UUID REFERENCES public.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_salon ON public.attendance_audit_log(salon_id);
CREATE INDEX idx_audit_log_attendance ON public.attendance_audit_log(attendance_id);

ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view audit logs" ON public.attendance_audit_log;
DROP POLICY IF EXISTS "Salon owner can view own audit logs" ON public.attendance_audit_log;

CREATE POLICY "Admin can view audit logs"
ON public.attendance_audit_log FOR SELECT
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Salon owner can view own audit logs"
ON public.attendance_audit_log FOR SELECT
USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Done!
SELECT 'Attendance schema migration complete!' as status;
