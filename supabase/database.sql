-- ============================================
-- SalonX Database Schema
-- PostgreSQL + Supabase with Row Level Security
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
    salon_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SALONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.salons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT DEFAULT 'Maharashtra',
    phone TEXT NOT NULL,
    email TEXT,
    logo_url TEXT,
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    business_type TEXT,
    opening_time TEXT DEFAULT '09:00',
    closing_time TEXT DEFAULT '21:00',
    working_days TEXT[] DEFAULT ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key from users to salons
ALTER TABLE public.users ADD CONSTRAINT fk_user_salon 
    FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE SET NULL;

-- ============================================
-- STAFF TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Hair Stylist',
    phone TEXT,
    email TEXT,
    aadhar TEXT,
    joining_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    service_ids UUID[] DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SERVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    notes TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_visit_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    appointment_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    total_amount DECIMAL(10,2),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'other')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('trial', 'core', 'standard', 'premium')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'past_due')),
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    trial_days_used INTEGER DEFAULT 0,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    razorpay_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_staff_salon ON public.staff(salon_id);
CREATE INDEX IF NOT EXISTS idx_services_salon ON public.services(salon_id);
CREATE INDEX IF NOT EXISTS idx_customers_salon ON public.customers(salon_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_salon ON public.appointments(salon_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON public.appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff ON public.appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_payments_salon ON public.payments(salon_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_salon ON public.subscriptions(salon_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Salons: visible to owner and staff
CREATE POLICY "Salon visible to members" ON public.salons
    FOR SELECT USING (
        owner_id = auth.uid() OR
        id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Salon editable by owner" ON public.salons
    FOR ALL USING (owner_id = auth.uid());

-- Staff: visible to salon members
CREATE POLICY "Staff visible to salon" ON public.staff
    FOR SELECT USING (
        salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Staff editable by salon owner" ON public.staff
    FOR ALL USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

-- Services: visible to salon members
CREATE POLICY "Services visible to salon" ON public.services
    FOR SELECT USING (
        salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Services editable by salon owner" ON public.services
    FOR ALL USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

-- Customers: visible to salon members
CREATE POLICY "Customers visible to salon" ON public.customers
    FOR SELECT USING (
        salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Customers editable by salon owner" ON public.customers
    FOR ALL USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

-- Appointments: visible to salon members
CREATE POLICY "Appointments visible to salon" ON public.appointments
    FOR SELECT USING (
        salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Appointments editable by salon owner" ON public.appointments
    FOR ALL USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

-- Payments: visible to salon members
CREATE POLICY "Payments visible to salon" ON public.payments
    FOR SELECT USING (
        salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Payments editable by salon owner" ON public.payments
    FOR ALL USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

-- Subscriptions: visible to salon owner only
CREATE POLICY "Subscriptions visible to owner" ON public.subscriptions
    FOR SELECT USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

CREATE POLICY "Subscriptions editable by owner" ON public.subscriptions
    FOR ALL USING (
        salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())
    );

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_salons_updated_at BEFORE UPDATE ON public.salons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION: Create salon and link user
-- ============================================
CREATE OR REPLACE FUNCTION create_salon_for_user(
    p_user_id UUID,
    p_salon_name TEXT,
    p_phone TEXT,
    p_city TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_salon_id UUID;
BEGIN
    -- Create the salon
    INSERT INTO public.salons (name, phone, city, owner_id)
    VALUES (p_salon_name, p_phone, p_city, p_user_id)
    RETURNING id INTO v_salon_id;

    -- Update user with salon_id
    UPDATE public.users SET salon_id = v_salon_id WHERE id = p_user_id;

    RETURN v_salon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
