-- Products and Inventory Tables Migration
-- Run this in Supabase SQL Editor

-- Create products table if not exists
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(100),
    type VARCHAR(50) NOT NULL CHECK (type IN ('service_use', 'retail_sale', 'both')),
    unit VARCHAR(50) NOT NULL,
    cost_price DECIMAL(10, 2),
    selling_price DECIMAL(10, 2),
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inventory table if not exists
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(salon_id, product_id)
);

-- Create suppliers table if not exists
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stock_movements table if not exists
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES public.suppliers(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER,
    quantity_after INTEGER,
    reference_type VARCHAR(50),
    reference_id UUID,
    reason TEXT,
    performed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bills table if not exists
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id),
    invoice_number VARCHAR(100),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    coupon_id UUID,
    coupon_code VARCHAR(50),
    tax_percent DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    final_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bill_items table if not exists
CREATE TABLE IF NOT EXISTS public.bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    service_id UUID,
    service_name VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create coupons table if not exists
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    max_discount DECIMAL(10, 2),
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(salon_id, code)
);

-- Create attendance table if not exists
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
    check_in_time TIME,
    check_out_time TIME,
    notes TEXT,
    is_locked BOOLEAN DEFAULT false,
    admin_override BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(staff_id, attendance_date)
);

-- Enable Row Level Security on new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

-- Create RLS policies for products (allow all operations)
CREATE POLICY "products_select_policy" ON public.products FOR SELECT USING (true);
CREATE POLICY "products_insert_policy" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update_policy" ON public.products FOR UPDATE USING (true);
CREATE POLICY "products_delete_policy" ON public.products FOR DELETE USING (true);

-- Drop and create policies for inventory
DROP POLICY IF EXISTS "inventory_select_policy" ON public.inventory;
DROP POLICY IF EXISTS "inventory_insert_policy" ON public.inventory;
DROP POLICY IF EXISTS "inventory_update_policy" ON public.inventory;
DROP POLICY IF EXISTS "inventory_delete_policy" ON public.inventory;

CREATE POLICY "inventory_select_policy" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "inventory_insert_policy" ON public.inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "inventory_update_policy" ON public.inventory FOR UPDATE USING (true);
CREATE POLICY "inventory_delete_policy" ON public.inventory FOR DELETE USING (true);

-- Drop and create policies for suppliers
DROP POLICY IF EXISTS "suppliers_select_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_policy" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete_policy" ON public.suppliers;

CREATE POLICY "suppliers_select_policy" ON public.suppliers FOR SELECT USING (true);
CREATE POLICY "suppliers_insert_policy" ON public.suppliers FOR INSERT WITH CHECK (true);
CREATE POLICY "suppliers_update_policy" ON public.suppliers FOR UPDATE USING (true);
CREATE POLICY "suppliers_delete_policy" ON public.suppliers FOR DELETE USING (true);

-- Drop and create policies for stock_movements
DROP POLICY IF EXISTS "stock_movements_select_policy" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_policy" ON public.stock_movements;

CREATE POLICY "stock_movements_select_policy" ON public.stock_movements FOR SELECT USING (true);
CREATE POLICY "stock_movements_insert_policy" ON public.stock_movements FOR INSERT WITH CHECK (true);

-- Drop and create policies for bills
DROP POLICY IF EXISTS "bills_select_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_insert_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_update_policy" ON public.bills;

CREATE POLICY "bills_select_policy" ON public.bills FOR SELECT USING (true);
CREATE POLICY "bills_insert_policy" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "bills_update_policy" ON public.bills FOR UPDATE USING (true);

-- Drop and create policies for bill_items
DROP POLICY IF EXISTS "bill_items_select_policy" ON public.bill_items;
DROP POLICY IF EXISTS "bill_items_insert_policy" ON public.bill_items;

CREATE POLICY "bill_items_select_policy" ON public.bill_items FOR SELECT USING (true);
CREATE POLICY "bill_items_insert_policy" ON public.bill_items FOR INSERT WITH CHECK (true);

-- Drop and create policies for coupons
DROP POLICY IF EXISTS "coupons_select_policy" ON public.coupons;
DROP POLICY IF EXISTS "coupons_insert_policy" ON public.coupons;
DROP POLICY IF EXISTS "coupons_update_policy" ON public.coupons;
DROP POLICY IF EXISTS "coupons_delete_policy" ON public.coupons;

CREATE POLICY "coupons_select_policy" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "coupons_insert_policy" ON public.coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "coupons_update_policy" ON public.coupons FOR UPDATE USING (true);
CREATE POLICY "coupons_delete_policy" ON public.coupons FOR DELETE USING (true);

-- Drop and create policies for attendance
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;

CREATE POLICY "attendance_select_policy" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "attendance_insert_policy" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "attendance_update_policy" ON public.attendance FOR UPDATE USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_salon_id ON public.products(salon_id);
CREATE INDEX IF NOT EXISTS idx_inventory_salon_id ON public.inventory(salon_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_bills_salon_id ON public.bills(salon_id);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON public.bills(created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_salon_date ON public.attendance(salon_id, attendance_date);
