/**
 * Customers API - Bulk Import and Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper to get session
async function getSession() {
    const cookieStore = await cookies();
    let sessionCookie = cookieStore.get('salon_session');
    if (!sessionCookie) {
        sessionCookie = cookieStore.get('salonx_session'); // Fallback
    }
    if (!sessionCookie) return null;

    try {
        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salon_id || session.salonId;
        return salonId && salonId !== 'admin' ? { salonId } : null;
    } catch {
        return null;
    }
}

// GET - Fetch all customers for the salon
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();
        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .eq('salon_id', session.salonId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Customers API] Error fetching:', error);
            return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
        }

        // Transform snake_case to camelCase
        const transformedCustomers = (customers || []).map(c => ({
            id: c.id,
            salonId: c.salon_id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            gender: c.gender,
            notes: c.notes,
            tags: c.tags || [],
            createdAt: c.created_at,
        }));

        return NextResponse.json({ customers: transformedCustomers });

    } catch (error) {
        console.error('[Customers API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create customers (supports bulk import)
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { customers: customersToImport } = body;

        if (!customersToImport || !Array.isArray(customersToImport)) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const now = new Date().toISOString();

        // Prepare customers for insert
        const customersData = customersToImport.map(c => ({
            salon_id: session.salonId,
            name: c.name?.trim() || 'Unknown',
            phone: c.phone?.trim() || '',
            email: c.email?.trim() || null,
            notes: c.notes?.trim() || null,
            tags: c.tags || ['Imported'],
            created_at: now,
        }));

        // Filter out any with empty name or phone
        const validCustomers = customersData.filter(c => c.name && c.phone);

        if (validCustomers.length === 0) {
            return NextResponse.json({
                error: 'No valid customers to import. Name and phone are required.',
                imported: 0,
                failed: customersToImport.length
            }, { status: 400 });
        }

        // Bulk insert
        const { data: inserted, error } = await supabase
            .from('customers')
            .insert(validCustomers)
            .select();

        if (error) {
            console.error('[Customers API] Bulk insert error:', error);
            return NextResponse.json({
                error: 'Failed to import customers: ' + error.message,
                imported: 0,
                failed: validCustomers.length
            }, { status: 500 });
        }

        // Transform response to camelCase
        const transformedCustomers = (inserted || []).map(c => ({
            id: c.id,
            salonId: c.salon_id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            gender: c.gender,
            notes: c.notes,
            tags: c.tags || [],
            createdAt: c.created_at,
        }));

        return NextResponse.json({
            success: true,
            imported: transformedCustomers.length,
            failed: customersToImport.length - validCustomers.length,
            customers: transformedCustomers
        });

    } catch (error) {
        console.error('[Customers API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Bulk delete customers (fast batch delete)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No customer IDs provided' }, { status: 400 });
        }

        console.log(`[Customers API] Bulk deleting ${ids.length} customers`);

        const supabase = getSupabaseAdmin();

        // First, delete related records to avoid foreign key constraint violations
        // Order matters: delete from child tables first, then parent

        // 1. Get all bills for these customers to delete their payments first
        const { data: customerBills } = await supabase
            .from('bills')
            .select('id')
            .in('customer_id', ids);

        if (customerBills && customerBills.length > 0) {
            const billIds = customerBills.map(b => b.id);
            console.log('[Customers API] Deleting payments for', billIds.length, 'bills');

            // Delete payments for these bills
            await supabase
                .from('payments')
                .delete()
                .in('bill_id', billIds);
        }

        // 2. Delete bills for these customers
        await supabase
            .from('bills')
            .delete()
            .in('customer_id', ids);

        // 3. Get all appointments for these customers to delete related services first
        const { data: customerAppointments } = await supabase
            .from('appointments')
            .select('id')
            .in('customer_id', ids);

        if (customerAppointments && customerAppointments.length > 0) {
            const appointmentIds = customerAppointments.map(a => a.id);
            console.log('[Customers API] Deleting appointment_services for', appointmentIds.length, 'appointments');

            // Delete appointment_services for these appointments
            await supabase
                .from('appointment_services')
                .delete()
                .in('appointment_id', appointmentIds);
        }

        // 4. Delete appointments for these customers
        await supabase
            .from('appointments')
            .delete()
            .in('customer_id', ids);

        // 5. Delete whatsapp_logs for these customers
        await supabase
            .from('whatsapp_logs')
            .delete()
            .in('customer_id', ids);

        // 6. Delete customer_preferences
        await supabase
            .from('customer_preferences')
            .delete()
            .in('customer_id', ids);

        // Now delete the customers - all related records should be gone
        const { error, count } = await supabase
            .from('customers')
            .delete({ count: 'exact' })
            .eq('salon_id', session.salonId)
            .in('id', ids);

        if (error) {
            console.error('[Customers API] Bulk delete error:', error);
            return NextResponse.json({ error: 'Failed to delete customers' }, { status: 500 });
        }

        console.log(`[Customers API] Successfully deleted ${count} customers`);

        return NextResponse.json({
            success: true,
            deleted: count,
            message: `${count} customer(s) deleted successfully`
        });

    } catch (error) {
        console.error('[Customers API] Delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

