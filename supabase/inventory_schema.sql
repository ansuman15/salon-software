-- ============================================
-- SalonX Products, Inventory & Suppliers Schema
-- Enterprise-grade with audit trail
-- ============================================

-- 1️⃣ PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    
    -- Type determines how product is used
    type TEXT NOT NULL CHECK (type IN ('service_use', 'retail_sale', 'both')),
    unit TEXT NOT NULL, -- 'ml', 'g', 'pcs', etc.
    
    cost_price NUMERIC(10,2),
    selling_price NUMERIC(10,2),
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_salon ON public.products(salon_id);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(is_active);

-- 2️⃣ SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_suppliers_salon ON public.suppliers(salon_id);

-- 3️⃣ INVENTORY TABLE (Current Stock State)
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (quantity >= 0), -- CRITICAL: Never negative
    
    reorder_level NUMERIC(10,2) DEFAULT 10,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One inventory record per product
    UNIQUE (product_id)
);

CREATE INDEX idx_inventory_salon ON public.inventory(salon_id);
CREATE INDEX idx_inventory_product ON public.inventory(product_id);
CREATE INDEX idx_inventory_low_stock ON public.inventory(quantity, reorder_level);

-- 4️⃣ STOCK MOVEMENTS TABLE (Audit Trail - APPEND ONLY)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    supplier_id UUID REFERENCES public.suppliers(id),
    
    movement_type TEXT NOT NULL
        CHECK (movement_type IN ('purchase', 'billing_deduction', 'manual_adjustment', 'correction', 'return')),
    
    quantity_change NUMERIC(10,2) NOT NULL, -- Positive = add, Negative = remove
    quantity_before NUMERIC(10,2),
    quantity_after NUMERIC(10,2),
    
    reference_type TEXT, -- 'billing', 'purchase_order', 'manual'
    reference_id UUID,
    
    reason TEXT,
    performed_by UUID REFERENCES public.users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: This table is append-only for audit integrity
-- No UPDATE or DELETE policies will be created

CREATE INDEX idx_movements_salon ON public.stock_movements(salon_id);
CREATE INDEX idx_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_movements_date ON public.stock_movements(created_at);
CREATE INDEX idx_movements_type ON public.stock_movements(movement_type);
CREATE INDEX idx_movements_supplier ON public.stock_movements(supplier_id);

-- 5️⃣ BILLING ITEMS TABLE (Deduction Source)
CREATE TABLE IF NOT EXISTS public.billing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    
    billing_id UUID, -- Link to main billing/invoice if exists
    
    quantity_used NUMERIC(10,2) NOT NULL CHECK (quantity_used > 0),
    unit_price NUMERIC(10,2),
    total_price NUMERIC(10,2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_items_salon ON public.billing_items(salon_id);
CREATE INDEX idx_billing_items_product ON public.billing_items(product_id);
CREATE INDEX idx_billing_items_date ON public.billing_items(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_items ENABLE ROW LEVEL SECURITY;

-- Products: Salon can manage own
CREATE POLICY "Salon can view own products" ON public.products
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage products" ON public.products
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Suppliers: Salon can manage own
CREATE POLICY "Salon can view own suppliers" ON public.suppliers
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage suppliers" ON public.suppliers
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Inventory: Salon can manage own
CREATE POLICY "Salon can view own inventory" ON public.inventory
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage inventory" ON public.inventory
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Stock Movements: READ-ONLY for salons (append via functions only)
CREATE POLICY "Salon can view own movements" ON public.stock_movements
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

-- No INSERT/UPDATE/DELETE policies for salons - only via server functions

-- Billing Items: Salon can manage own
CREATE POLICY "Salon can view own billing items" ON public.billing_items
    FOR SELECT USING (salon_id IN (SELECT salon_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Salon owner can manage billing items" ON public.billing_items
    FOR ALL USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE INVENTORY ON PRODUCT CREATE
-- ============================================
CREATE OR REPLACE FUNCTION auto_create_inventory()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.inventory (salon_id, product_id, quantity, reorder_level)
    VALUES (NEW.salon_id, NEW.id, 0, 10)
    ON CONFLICT (product_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_inventory_on_product
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION auto_create_inventory();

-- ============================================
-- ATOMIC BILLING DEDUCTION FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION deduct_inventory_for_billing(
    p_salon_id UUID,
    p_product_id UUID,
    p_quantity NUMERIC,
    p_billing_id UUID DEFAULT NULL,
    p_unit_price NUMERIC DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_quantity NUMERIC,
    billing_item_id UUID
) AS $$
DECLARE
    v_current_quantity NUMERIC;
    v_billing_item_id UUID;
BEGIN
    -- Lock the inventory row for update
    SELECT quantity INTO v_current_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
    FOR UPDATE;
    
    -- Check if enough stock
    IF v_current_quantity IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Product not found in inventory'::TEXT, 0::NUMERIC, NULL::UUID;
        RETURN;
    END IF;
    
    IF v_current_quantity < p_quantity THEN
        RETURN QUERY SELECT FALSE, 
            format('Insufficient stock. Available: %s, Required: %s', v_current_quantity, p_quantity)::TEXT,
            v_current_quantity,
            NULL::UUID;
        RETURN;
    END IF;
    
    -- Update inventory
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id;
    
    -- Create billing item
    INSERT INTO public.billing_items (salon_id, product_id, billing_id, quantity_used, unit_price, total_price)
    VALUES (p_salon_id, p_product_id, p_billing_id, p_quantity, p_unit_price, p_quantity * COALESCE(p_unit_price, 0))
    RETURNING id INTO v_billing_item_id;
    
    -- Create audit trail
    INSERT INTO public.stock_movements (
        salon_id, product_id, movement_type, quantity_change,
        quantity_before, quantity_after, reference_type, reference_id, performed_by
    )
    VALUES (
        p_salon_id, p_product_id, 'billing_deduction', -p_quantity,
        v_current_quantity, v_current_quantity - p_quantity,
        'billing', v_billing_item_id, p_performed_by
    );
    
    RETURN QUERY SELECT TRUE, 'Stock deducted successfully'::TEXT, 
        (v_current_quantity - p_quantity), v_billing_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STOCK PURCHASE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION add_stock_purchase(
    p_salon_id UUID,
    p_product_id UUID,
    p_quantity NUMERIC,
    p_supplier_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'Stock purchase',
    p_performed_by UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_quantity NUMERIC
) AS $$
DECLARE
    v_current_quantity NUMERIC;
BEGIN
    -- Lock and get current quantity
    SELECT quantity INTO v_current_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
    FOR UPDATE;
    
    IF v_current_quantity IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Product not found in inventory'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;
    
    -- Update inventory
    UPDATE public.inventory
    SET quantity = quantity + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id;
    
    -- Create audit trail
    INSERT INTO public.stock_movements (
        salon_id, product_id, supplier_id, movement_type, quantity_change,
        quantity_before, quantity_after, reference_type, reason, performed_by
    )
    VALUES (
        p_salon_id, p_product_id, p_supplier_id, 'purchase', p_quantity,
        v_current_quantity, v_current_quantity + p_quantity,
        'purchase_order', p_reason, p_performed_by
    );
    
    RETURN QUERY SELECT TRUE, 'Stock added successfully'::TEXT, 
        (v_current_quantity + p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MANUAL ADJUSTMENT FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION adjust_inventory_manual(
    p_salon_id UUID,
    p_product_id UUID,
    p_quantity_change NUMERIC, -- Positive to add, negative to reduce
    p_reason TEXT,
    p_performed_by UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_quantity NUMERIC
) AS $$
DECLARE
    v_current_quantity NUMERIC;
    v_new_quantity NUMERIC;
BEGIN
    -- Reason is mandatory
    IF p_reason IS NULL OR p_reason = '' THEN
        RETURN QUERY SELECT FALSE, 'Reason is required for manual adjustment'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;
    
    -- Lock and get current quantity
    SELECT quantity INTO v_current_quantity
    FROM public.inventory
    WHERE product_id = p_product_id
    FOR UPDATE;
    
    IF v_current_quantity IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Product not found in inventory'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;
    
    v_new_quantity := v_current_quantity + p_quantity_change;
    
    -- Check if result would be negative
    IF v_new_quantity < 0 THEN
        RETURN QUERY SELECT FALSE, 
            format('Cannot reduce below zero. Current: %s, Change: %s', v_current_quantity, p_quantity_change)::TEXT,
            v_current_quantity;
        RETURN;
    END IF;
    
    -- Update inventory
    UPDATE public.inventory
    SET quantity = v_new_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id;
    
    -- Create audit trail
    INSERT INTO public.stock_movements (
        salon_id, product_id, movement_type, quantity_change,
        quantity_before, quantity_after, reference_type, reason, performed_by
    )
    VALUES (
        p_salon_id, p_product_id, 'manual_adjustment', p_quantity_change,
        v_current_quantity, v_new_quantity, 'manual', p_reason, p_performed_by
    );
    
    RETURN QUERY SELECT TRUE, 'Adjustment applied successfully'::TEXT, v_new_quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INVENTORY SUMMARY VIEW
-- ============================================
CREATE OR REPLACE VIEW public.inventory_summary AS
SELECT 
    i.id,
    i.salon_id,
    i.product_id,
    p.name AS product_name,
    p.category,
    p.brand,
    p.unit,
    p.cost_price,
    p.selling_price,
    i.quantity,
    i.reorder_level,
    CASE 
        WHEN i.quantity <= 0 THEN 'out_of_stock'
        WHEN i.quantity <= i.reorder_level THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status,
    i.updated_at
FROM public.inventory i
JOIN public.products p ON p.id = i.product_id
WHERE p.is_active = TRUE;

-- Done!
SELECT 'Inventory schema created successfully!' as status;
