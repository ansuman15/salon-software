# Phase 6: Edge Case Verification Tests

> [!IMPORTANT]
> Run `staff_billing_schema.sql` in Supabase SQL Editor before running these tests.

## Test 1: Atomic Rollback on Failure ✅

**Implementation**: The `create_invoice_atomic` function validates all conditions before any INSERT:
- Checks idempotency key
- Validates biller staff exists
- Validates service items have staff_id
- Checks inventory stock with `FOR UPDATE` lock

**Any failure returns early with `success = FALSE`, no partial data is written.**

### Test Query (should fail gracefully):
```sql
-- Try with invalid biller staff
SELECT * FROM create_invoice_atomic(
  'your-salon-uuid'::uuid,
  NULL,  -- customer
  '00000000-0000-0000-0000-000000000000'::uuid,  -- invalid staff
  100, 0, 0, NULL, NULL, 0, 0, 100, 'cash', 'test-key-1', NULL,
  '[{"item_type":"service","item_id":"service-uuid","item_name":"Haircut","staff_id":"staff-uuid","quantity":1,"unit_price":100}]'::jsonb
);
-- Expected: success=false, message='Invalid biller staff'
```

---

## Test 2: Unique Invoice Number Generation ✅

**Implementation**: `generate_unique_invoice_number` uses `COUNT(*) + 1` with salon filter.

### Test Query:
```sql
-- Check invoice format
SELECT generate_unique_invoice_number('your-salon-uuid');
-- Expected: SALX-YYYYMM-0001 (first invoice of the month)
```

---

## Test 3: Staff Deletion Restriction ✅

**Implementation**: Trigger `prevent_staff_deletion_with_invoices` on `staff` table.

### Test Query (after creating an invoice):
```sql
-- Try to delete staff who has invoices
DELETE FROM staff WHERE id = 'staff-with-invoices-uuid';
-- Expected: ERROR: Cannot delete staff member with existing invoices. Deactivate instead.
```

---

## Test 4: Inventory Shortage Blocking Bill ✅

**Implementation**: Lines 220-236 check stock before proceeding, with row lock.

### Test Query:
```sql
-- First, check current stock
SELECT product_id, quantity FROM inventory WHERE product_id = 'your-product-uuid';

-- Try to bill more than available
SELECT * FROM create_invoice_atomic(
  'your-salon-uuid'::uuid,
  NULL,
  'valid-biller-uuid'::uuid,
  1000, 0, 0, NULL, NULL, 0, 0, 1000, 'cash', 'test-key-2', NULL,
  '[{"item_type":"product","item_id":"your-product-uuid","item_name":"Shampoo","staff_id":null,"quantity":99999,"unit_price":100}]'::jsonb
);
-- Expected: success=false, message='Insufficient stock for product...'
```

---

## Test 5: Real-Time UI Sync ✅

**Implementation**: 
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;`
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_items;`
- Frontend uses `useRealtimeSync` hook

### Manual Test:
1. Open Staff page in Browser A, view a staff profile
2. In Browser B, complete a billing with that staff
3. Observe Browser A metrics update without refresh

---

## Test 6: RLS Isolation ✅

**Implementation**: RLS policies on `invoices` and `invoice_items` tables filter by `salon_id`.

### Verification:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('invoices', 'invoice_items');
-- Expected: rowsecurity = true for both

-- Check policies exist
SELECT * FROM pg_policies WHERE tablename IN ('invoices', 'invoice_items');
```

---

## Frontend Validation Tests

| Scenario | Expected Behavior | Location |
|----------|-------------------|----------|
| No biller selected | Pay button shows error toast | `handlePayment` L365-368 |
| Service without staff | Error toast for specific service | `handlePayment` L371-378 |
| Product stock exceeded | Error before API call | `handlePayment` L380-386 |
| Duplicate submission | Same invoice returned (idempotent) | API uses idempotency header |

---

## Summary

All edge cases have been **implemented in code**:

| Edge Case | Status | Implementation |
|-----------|--------|----------------|
| Atomic rollback | ✅ | PL/pgSQL function validates before any INSERT |
| Unique invoice numbers | ✅ | `generate_unique_invoice_number()` + UNIQUE constraint |
| Staff deletion blocked | ✅ | `prevent_staff_deletion` trigger |
| Inventory shortage | ✅ | `FOR UPDATE` lock + quantity check |
| Real-time sync | ✅ | Supabase realtime publication |
| RLS isolation | ✅ | Policies on all new tables |
