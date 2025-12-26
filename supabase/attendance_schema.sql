-- ============================================
-- SalonX Attendance Table Schema (Enhanced)
-- ============================================

-- Drop existing table if exists (for clean migration)
DROP TABLE IF EXISTS public.attendance CASCADE;

-- ATTENDANCE TABLE
-- One record per staff per day (enforced by unique constraint)
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
    
    -- Payroll lock flag (once payroll processed, cannot edit)
    is_locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES public.users(id),
    
    -- Admin override tracking
    last_modified_by UUID REFERENCES public.users(id),
    admin_override BOOLEAN DEFAULT FALSE,
    admin_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- CRITICAL: Enforce one record per staff per date
    UNIQUE (staff_id, attendance_date)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_attendance_salon ON public.attendance(salon_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX idx_attendance_staff ON public.attendance(staff_id);
CREATE INDEX idx_attendance_salon_date ON public.attendance(salon_id, attendance_date);
CREATE INDEX idx_attendance_staff_date_range ON public.attendance(staff_id, attendance_date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy 1: Salon can view own attendance
CREATE POLICY "Salon can view own attendance" 
ON public.attendance
FOR SELECT
USING (
    salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
);

-- Policy 2: Salon owner can manage own attendance
CREATE POLICY "Salon owner can manage own attendance"
ON public.attendance
FOR ALL
USING (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
)
WITH CHECK (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
);

-- Policy 3: Admin full access (for override)
CREATE POLICY "Admin full access to attendance"
ON public.attendance
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE TRIGGER update_attendance_updated_at 
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION: Idempotent Upsert with Validation
-- ============================================
CREATE OR REPLACE FUNCTION upsert_attendance(
    p_salon_id UUID,
    p_staff_id UUID,
    p_attendance_date DATE,
    p_status TEXT,
    p_check_in_time TIME DEFAULT NULL,
    p_check_out_time TIME DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT FALSE
)
RETURNS public.attendance AS $$
DECLARE
    v_result public.attendance;
    v_existing RECORD;
    v_lock_threshold INTEGER := 30; -- Days after which records are locked
BEGIN
    -- Validate status
    IF p_status NOT IN ('present', 'absent', 'half_day', 'leave') THEN
        RAISE EXCEPTION 'Invalid status: %', p_status;
    END IF;
    
    -- Validate date (no future dates)
    IF p_attendance_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot mark attendance for future dates';
    END IF;
    
    -- Check if record exists and is locked
    SELECT * INTO v_existing 
    FROM public.attendance 
    WHERE staff_id = p_staff_id AND attendance_date = p_attendance_date;
    
    IF v_existing IS NOT NULL AND v_existing.is_locked AND NOT p_is_admin THEN
        RAISE EXCEPTION 'Attendance record is locked and cannot be edited';
    END IF;
    
    -- Check lock threshold (non-admin cannot edit records older than threshold)
    IF p_attendance_date < (CURRENT_DATE - v_lock_threshold) AND NOT p_is_admin THEN
        RAISE EXCEPTION 'Cannot edit attendance older than % days', v_lock_threshold;
    END IF;
    
    -- Perform upsert
    INSERT INTO public.attendance (
        salon_id, staff_id, attendance_date, status, 
        check_in_time, check_out_time, notes,
        last_modified_by, admin_override
    )
    VALUES (
        p_salon_id, p_staff_id, p_attendance_date, p_status,
        p_check_in_time, p_check_out_time, p_notes,
        p_user_id, p_is_admin
    )
    ON CONFLICT (staff_id, attendance_date) DO UPDATE SET
        status = EXCLUDED.status,
        check_in_time = EXCLUDED.check_in_time,
        check_out_time = EXCLUDED.check_out_time,
        notes = EXCLUDED.notes,
        last_modified_by = EXCLUDED.last_modified_by,
        admin_override = CASE WHEN p_is_admin THEN TRUE ELSE attendance.admin_override END,
        updated_at = NOW()
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get Monthly Summary (Payroll Ready)
-- ============================================
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
        COUNT(*) FILTER (WHERE a.status = 'present')::INTEGER AS total_present_days,
        COUNT(*) FILTER (WHERE a.status = 'half_day')::INTEGER AS total_half_days,
        COUNT(*) FILTER (WHERE a.status = 'absent')::INTEGER AS total_absent_days,
        COUNT(*) FILTER (WHERE a.status = 'leave')::INTEGER AS total_leave_days,
        COALESCE(
            SUM(
                CASE 
                    WHEN a.check_out_time IS NOT NULL AND a.check_in_time IS NOT NULL 
                    THEN a.check_out_time - a.check_in_time 
                    ELSE INTERVAL '0 hours'
                END
            ),
            INTERVAL '0 hours'
        ) AS total_working_hours
    FROM public.attendance a
    WHERE a.salon_id = p_salon_id
      AND a.staff_id = p_staff_id
      AND EXTRACT(YEAR FROM a.attendance_date) = p_year
      AND EXTRACT(MONTH FROM a.attendance_date) = p_month
    GROUP BY a.staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Lock Attendance for Payroll
-- ============================================
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

-- ============================================
-- AUDIT LOG TABLE (for admin overrides)
-- ============================================
CREATE TABLE IF NOT EXISTS public.attendance_audit_log (
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

-- Enable RLS on audit log
ALTER TABLE public.attendance_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can view audit logs
CREATE POLICY "Admin can view audit logs"
ON public.attendance_audit_log
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Salon owner can view own audit logs
CREATE POLICY "Salon owner can view own audit logs"
ON public.attendance_audit_log
FOR SELECT
USING (
    salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
);
