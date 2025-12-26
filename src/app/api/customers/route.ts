/**
 * Customers API - Bulk Import to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Fetch all customers for the salon
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salonId;

        if (!salonId || salonId === 'admin') {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();
        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .eq('salon_id', salonId)
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
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salonId;

        if (!salonId || salonId === 'admin') {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
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
            salon_id: salonId,
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
