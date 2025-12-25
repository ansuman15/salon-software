-- ============================================
-- SalonX Auth Schema (Admin-Controlled)
-- Run AFTER base database.sql
-- ============================================

-- ============================================
-- LEADS TABLE (from landing page signups)
-- ============================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT,
    staff_size TEXT,
    requirements TEXT,
    
    status TEXT DEFAULT 'new' 
        CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'rejected')),
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ACTIVATION KEYS (heart of auth system)
-- ============================================
CREATE TABLE IF NOT EXISTS public.activation_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    
    key_hash TEXT NOT NULL,  -- bcrypt hash, NEVER store plaintext
    
    -- 'active' = valid for login, 'revoked' = manually disabled, 'expired' = past expiry date
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked', 'expired')),
    
    expires_at TIMESTAMPTZ,  -- NULL = never expires (after first successful login)
    first_used_at TIMESTAMPTZ,  -- Track when first used (for analytics)
    created_by_admin UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active key per salon (critical constraint)
CREATE UNIQUE INDEX IF NOT EXISTS one_active_key_per_salon
    ON public.activation_keys (salon_id)
    WHERE status = 'active';

-- ============================================
-- ADMIN AUDIT LOGS (mandatory for compliance)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying logs by target
CREATE INDEX IF NOT EXISTS idx_audit_logs_target 
    ON public.admin_audit_logs(target_type, target_id);

-- Index for querying logs by admin
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin 
    ON public.admin_audit_logs(admin_id);

-- ============================================
-- ALTER SALONS TABLE (add auth fields)
-- ============================================
ALTER TABLE public.salons 
    ADD COLUMN IF NOT EXISTS owner_email TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive' 
        CHECK (status IN ('inactive', 'active', 'suspended')),
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Index for login lookups
CREATE INDEX IF NOT EXISTS idx_salons_owner_email 
    ON public.salons(owner_email);

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Leads: Admin only
CREATE POLICY "Admin only leads" ON public.leads
    FOR ALL USING (
        auth.jwt()->>'email' IN ('admin@salonx.in', 'developer@salonx.in')
    );

-- Activation keys: Admin only (NEVER expose to salons)
CREATE POLICY "Admin only activation_keys" ON public.activation_keys
    FOR ALL USING (
        auth.jwt()->>'email' IN ('admin@salonx.in', 'developer@salonx.in')
    );

-- Audit logs: Admin only
CREATE POLICY "Admin only audit_logs" ON public.admin_audit_logs
    FOR ALL USING (
        auth.jwt()->>'email' IN ('admin@salonx.in', 'developer@salonx.in')
    );

-- ============================================
-- FUNCTION: Expire old activation keys (cron)
-- ============================================
CREATE OR REPLACE FUNCTION expire_activation_keys()
RETURNS void AS $$
BEGIN
    UPDATE public.activation_keys
    SET status = 'expired'
    WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_leads_updated_at 
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
