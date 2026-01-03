-- ============================================
-- SalonX Staff-Attributed Billing Schema
-- Invoices with staff attribution & real-time metrics
-- ============================================

-- 1️⃣ STAFF TABLE EXTENSION - Add cashier flag
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS is_cashier BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.staff.is_cashier IS 'Staff member can act as cashier/biller';

-- 2️⃣ INVOICE SEQUENCE - Thread-safe unique number per salon per month
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1;

-- 3️⃣ INVOICES TABLE - Core billing with staff attribution
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    
    invoice_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    
    -- Staff Attribution (CRITICAL)
    billed_by_staff_id UUID NOT NULL REFERENCES public.staff(id),
    
    -- Financial data
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_percent NUMERIC(5,2) DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    coupon_id UUID REFERENCES public.coupons(id),
    coupon_code TEXT,
    tax_percent NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(10,2) DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL,
    
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    
    -- Idempotency
    idempotency_key TEXT,
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_invoice_number UNIQUE (salon_id, invoice_number),
    CONSTRAINT unique_idempotency UNIQUE (salon_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_invoices_salon ON public.invoices(salon_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_billed_by ON public.invoices(billed_by_staff_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);

-- 4️⃣ INVOICE ITEMS TABLE - Line items with staff attribution
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    
    item_type TEXT NOT NULL CHECK (item_type IN ('service', 'product')),
    item_id UUID NOT NULL, -- References service_id or product_id
    item_name TEXT NOT NULL,
    
    -- Staff who performed/sold (mandatory for services)
    staff_id UUID REFERENCES public.staff(id),
    
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_staff ON public.invoice_items(staff_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_type ON public.invoice_items(item_type);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Invoices: Salon can view own invoices
DROP POLICY IF EXISTS "Salon can view own invoices" ON public.invoices;
CREATE POLICY "Salon can view own invoices" ON public.invoices
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Salon owner can manage invoices" ON public.invoices;
CREATE POLICY "Salon owner can manage invoices" ON public.invoices
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Invoice Items: Salon can view own invoice items
DROP POLICY IF EXISTS "Salon can view own invoice items" ON public.invoice_items;
CREATE POLICY "Salon can view own invoice items" ON public.invoice_items
    FOR SELECT USING (invoice_id IN (SELECT id FROM public.invoices WHERE salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "Salon owner can manage invoice items" ON public.invoice_items;
CREATE POLICY "Salon owner can manage invoice items" ON public.invoice_items
    FOR ALL USING (invoice_id IN (SELECT id FROM public.invoices WHERE salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid())));

-- ============================================
-- 5️⃣ STAFF PERFORMANCE VIEW (DERIVED METRICS)
-- ============================================

-- Drop if exists for safe re-creation
DROP VIEW IF EXISTS public.staff_performance;

CREATE VIEW public.staff_performance AS
SELECT
    s.id AS staff_id,
    s.salon_id,
    s.name AS staff_name,
    s.role,
    s.is_active,
    -- Metrics from invoices where staff BILLED
    COUNT(DISTINCT CASE WHEN inv.id IS NOT NULL THEN inv.id END) AS bills_created,
    -- Metrics from invoice items where staff PERFORMED
    COUNT(DISTINCT CASE WHEN ii.item_type = 'service' AND ii.staff_id = s.id THEN ii.id END) AS services_performed,
    COUNT(DISTINCT CASE WHEN ii.item_type = 'product' AND ii.staff_id = s.id THEN ii.id END) AS products_sold,
    COALESCE(SUM(CASE WHEN ii.staff_id = s.id THEN ii.total_price ELSE 0 END), 0) AS revenue_generated,
    -- Total items handled (both service and product)
    COUNT(DISTINCT CASE WHEN ii.staff_id = s.id THEN ii.id END) AS total_items_handled
FROM public.staff s
LEFT JOIN public.invoices inv ON inv.billed_by_staff_id = s.id
LEFT JOIN public.invoice_items ii ON ii.staff_id = s.id
GROUP BY s.id, s.salon_id, s.name, s.role, s.is_active;

-- ============================================
-- 6️⃣ INVOICE NUMBER GENERATION (THREAD-SAFE)
-- ============================================

CREATE OR REPLACE FUNCTION generate_unique_invoice_number(p_salon_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_year_month TEXT;
    v_count INTEGER;
    v_invoice_number TEXT;
BEGIN
    -- Format: SALX-YYYYMM-XXXX
    v_year_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    
    -- Lock and count for this salon and month
    SELECT COUNT(*) + 1 INTO v_count
    FROM public.invoices
    WHERE salon_id = p_salon_id
      AND invoice_number LIKE 'SALX-' || v_year_month || '-%'
    FOR UPDATE;
    
    v_invoice_number := 'SALX-' || v_year_month || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7️⃣ ATOMIC BILLING TRANSACTION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION create_invoice_atomic(
    p_salon_id UUID,
    p_customer_id UUID,
    p_billed_by_staff_id UUID,
    p_subtotal NUMERIC,
    p_discount_percent NUMERIC,
    p_discount_amount NUMERIC,
    p_coupon_id UUID,
    p_coupon_code TEXT,
    p_tax_percent NUMERIC,
    p_tax_amount NUMERIC,
    p_total_amount NUMERIC,
    p_payment_method TEXT,
    p_idempotency_key TEXT,
    p_notes TEXT,
    p_items JSONB -- Array of {item_type, item_id, item_name, staff_id, quantity, unit_price}
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    invoice_id UUID,
    invoice_number TEXT
) AS $$
DECLARE
    v_invoice_id UUID;
    v_invoice_number TEXT;
    v_item JSONB;
    v_product_id UUID;
    v_quantity NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    -- Check idempotency first
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, invoices.invoice_number INTO v_invoice_id, v_invoice_number
        FROM public.invoices
        WHERE salon_id = p_salon_id AND idempotency_key = p_idempotency_key;
        
        IF v_invoice_id IS NOT NULL THEN
            RETURN QUERY SELECT TRUE, 'Invoice already exists (idempotent)'::TEXT, v_invoice_id, v_invoice_number;
            RETURN;
        END IF;
    END IF;
    
    -- Validate billed_by_staff exists and belongs to salon
    IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_billed_by_staff_id AND salon_id = p_salon_id) THEN
        RETURN QUERY SELECT FALSE, 'Invalid biller staff'::TEXT, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;
    
    -- Validate service items have staff_id
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        IF (v_item->>'item_type') = 'service' AND (v_item->>'staff_id') IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Service items require staff_id'::TEXT, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;
        
        -- Check inventory for products
        IF (v_item->>'item_type') = 'product' THEN
            v_product_id := (v_item->>'item_id')::UUID;
            v_quantity := (v_item->>'quantity')::NUMERIC;
            
            SELECT quantity INTO v_current_stock
            FROM public.inventory
            WHERE product_id = v_product_id
            FOR UPDATE;
            
            IF v_current_stock IS NULL OR v_current_stock < v_quantity THEN
                RETURN QUERY SELECT FALSE, 
                    format('Insufficient stock for product. Available: %s, Required: %s', COALESCE(v_current_stock, 0), v_quantity)::TEXT,
                    NULL::UUID, NULL::TEXT;
                RETURN;
            END IF;
        END IF;
    END LOOP;
    
    -- Generate unique invoice number
    v_invoice_number := generate_unique_invoice_number(p_salon_id);
    
    -- Create invoice
    INSERT INTO public.invoices (
        salon_id, invoice_number, customer_id, billed_by_staff_id,
        subtotal, discount_percent, discount_amount, coupon_id, coupon_code,
        tax_percent, tax_amount, total_amount, payment_method,
        payment_status, idempotency_key, notes
    ) VALUES (
        p_salon_id, v_invoice_number, p_customer_id, p_billed_by_staff_id,
        p_subtotal, p_discount_percent, p_discount_amount, p_coupon_id, p_coupon_code,
        p_tax_percent, p_tax_amount, p_total_amount, p_payment_method,
        'paid', p_idempotency_key, p_notes
    )
    RETURNING id INTO v_invoice_id;
    
    -- Insert items and deduct inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id, item_type, item_id, item_name, staff_id,
            quantity, unit_price, total_price
        ) VALUES (
            v_invoice_id,
            v_item->>'item_type',
            (v_item->>'item_id')::UUID,
            v_item->>'item_name',
            NULLIF(v_item->>'staff_id', '')::UUID,
            (v_item->>'quantity')::NUMERIC,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC
        );
        
        -- Deduct inventory for products
        IF (v_item->>'item_type') = 'product' THEN
            v_product_id := (v_item->>'item_id')::UUID;
            v_quantity := (v_item->>'quantity')::NUMERIC;
            
            -- Get current stock for audit
            SELECT quantity INTO v_current_stock FROM public.inventory WHERE product_id = v_product_id;
            
            -- Deduct
            UPDATE public.inventory
            SET quantity = quantity - v_quantity, updated_at = NOW()
            WHERE product_id = v_product_id;
            
            -- Audit trail
            INSERT INTO public.stock_movements (
                salon_id, product_id, movement_type, quantity_change,
                quantity_before, quantity_after, reference_type, reference_id
            ) VALUES (
                p_salon_id, v_product_id, 'billing_deduction', -v_quantity,
                v_current_stock, v_current_stock - v_quantity, 'invoice', v_invoice_id
            );
        END IF;
    END LOOP;
    
    -- Increment coupon usage if used
    IF p_coupon_id IS NOT NULL THEN
        UPDATE public.coupons
        SET used_count = used_count + 1, updated_at = NOW()
        WHERE id = p_coupon_id;
    END IF;
    
    RETURN QUERY SELECT TRUE, 'Invoice created successfully'::TEXT, v_invoice_id, v_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8️⃣ PREVENT STAFF DELETION IF INVOICES EXIST
-- ============================================

CREATE OR REPLACE FUNCTION prevent_staff_deletion_with_invoices()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if staff has any invoices (as biller)
    IF EXISTS (SELECT 1 FROM public.invoices WHERE billed_by_staff_id = OLD.id LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot delete staff member with existing invoices. Deactivate instead.';
    END IF;
    
    -- Check if staff performed any services
    IF EXISTS (SELECT 1 FROM public.invoice_items WHERE staff_id = OLD.id LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot delete staff member who has performed services. Deactivate instead.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_staff_deletion ON public.staff;
CREATE TRIGGER prevent_staff_deletion
BEFORE DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION prevent_staff_deletion_with_invoices();

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================

-- Enable realtime for invoices and invoice_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_items;

SELECT 'Staff billing schema created successfully!' as status;
