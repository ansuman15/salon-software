-- ============================================
-- SalonX Billing & Coupons Schema
-- Run in order: coupons → bills → bill_items
-- ============================================

-- 1️⃣ COUPONS TABLE (must be first - referenced by bills)
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    
    code TEXT NOT NULL,
    description TEXT,
    
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL,
    
    min_order_value NUMERIC(10,2) DEFAULT 0,
    max_discount NUMERIC(10,2), -- Cap for percentage discounts
    
    max_uses INTEGER, -- NULL = unlimited
    used_count INTEGER NOT NULL DEFAULT 0,
    
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (salon_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_salon ON public.coupons(salon_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);

-- 2️⃣ BILLS TABLE
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id),
    
    invoice_number TEXT NOT NULL,
    
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    coupon_id UUID REFERENCES public.coupons(id),
    coupon_code TEXT,
    tax_percent NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    final_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_invoice ON public.bills(salon_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_bills_salon ON public.bills(salon_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON public.bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_date ON public.bills(created_at);

-- 3️⃣ BILL ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id),
    
    service_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON public.bill_items(bill_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Salon can view own coupons" ON public.coupons;
DROP POLICY IF EXISTS "Salon owner can manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Salon can view own bills" ON public.bills;
DROP POLICY IF EXISTS "Salon owner can manage bills" ON public.bills;
DROP POLICY IF EXISTS "Salon can view own bill items" ON public.bill_items;
DROP POLICY IF EXISTS "Salon owner can manage bill items" ON public.bill_items;

-- Coupons policies
CREATE POLICY "Salon can view own coupons" ON public.coupons
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage coupons" ON public.coupons
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Bills policies
CREATE POLICY "Salon can view own bills" ON public.bills
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage bills" ON public.bills
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Bill items policies
CREATE POLICY "Salon can view own bill items" ON public.bill_items
    FOR SELECT USING (bill_id IN (SELECT id FROM public.bills WHERE salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Salon owner can manage bill items" ON public.bill_items
    FOR ALL USING (bill_id IN (SELECT id FROM public.bills WHERE salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_salon_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_date TEXT;
    v_count INTEGER;
BEGIN
    v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM public.bills
    WHERE salon_id = p_salon_id
      AND DATE(created_at) = CURRENT_DATE;
    
    RETURN 'INV-' || v_date || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Validate coupon
CREATE OR REPLACE FUNCTION validate_coupon(
    p_salon_id UUID,
    p_code TEXT,
    p_order_value NUMERIC
)
RETURNS TABLE (
    valid BOOLEAN,
    message TEXT,
    coupon_id UUID,
    discount_type TEXT,
    discount_value NUMERIC,
    max_discount NUMERIC
) AS $$
DECLARE
    v_coupon RECORD;
BEGIN
    SELECT * INTO v_coupon
    FROM public.coupons c
    WHERE c.salon_id = p_salon_id
      AND UPPER(c.code) = UPPER(p_code)
      AND c.is_active = TRUE;
    
    IF v_coupon IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Invalid coupon code'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;
    
    IF v_coupon.valid_from IS NOT NULL AND CURRENT_DATE < v_coupon.valid_from THEN
        RETURN QUERY SELECT FALSE, 'Coupon not yet valid'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;
    
    IF v_coupon.valid_until IS NOT NULL AND CURRENT_DATE > v_coupon.valid_until THEN
        RETURN QUERY SELECT FALSE, 'Coupon has expired'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;
    
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
        RETURN QUERY SELECT FALSE, 'Coupon usage limit reached'::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;
    
    IF v_coupon.min_order_value IS NOT NULL AND p_order_value < v_coupon.min_order_value THEN
        RETURN QUERY SELECT FALSE, ('Minimum order ₹' || v_coupon.min_order_value)::TEXT, NULL::UUID, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT 
        TRUE, 
        'Coupon applied!'::TEXT, 
        v_coupon.id,
        v_coupon.discount_type,
        v_coupon.discount_value,
        v_coupon.max_discount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment coupon usage
CREATE OR REPLACE FUNCTION increment_coupon_usage(p_coupon_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = p_coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS update_bills_updated_at ON public.bills;
DROP TRIGGER IF EXISTS update_coupons_updated_at ON public.coupons;

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

SELECT 'Billing schema created successfully!' as status;
