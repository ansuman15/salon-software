import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface SessionData {
    salonId: string;
}

async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');
    if (!sessionCookie) return null;
    try {
        return JSON.parse(sessionCookie.value);
    } catch {
        return null;
    }
}

/**
 * GET /api/debug/schema
 * Check database schema and connectivity
 */
export async function GET() {
    try {
        const session = await getSession();
        const results: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            session: session ? { salonId: session.salonId } : null,
            tables: {},
            errors: [],
        };

        if (!session?.salonId) {
            results.errors = ['Not authenticated - no session found'];
            return NextResponse.json(results);
        }

        const supabase = getSupabaseAdmin();

        // Check products table
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id')
            .eq('salon_id', session.salonId)
            .limit(1);

        results.tables = {
            ...results.tables as object,
            products: {
                exists: !productsError,
                error: productsError?.message || null,
                code: productsError?.code || null,
                count: products?.length || 0,
            },
        };

        // Check inventory table
        const { data: inventory, error: inventoryError } = await supabase
            .from('inventory')
            .select('id')
            .eq('salon_id', session.salonId)
            .limit(1);

        results.tables = {
            ...results.tables as object,
            inventory: {
                exists: !inventoryError,
                error: inventoryError?.message || null,
                code: inventoryError?.code || null,
                count: inventory?.length || 0,
            },
        };

        // Check suppliers table
        const { data: suppliers, error: suppliersError } = await supabase
            .from('suppliers')
            .select('id')
            .eq('salon_id', session.salonId)
            .limit(1);

        results.tables = {
            ...results.tables as object,
            suppliers: {
                exists: !suppliersError,
                error: suppliersError?.message || null,
                code: suppliersError?.code || null,
                count: suppliers?.length || 0,
            },
        };

        // Check bills table
        const { data: bills, error: billsError } = await supabase
            .from('bills')
            .select('id')
            .eq('salon_id', session.salonId)
            .limit(1);

        results.tables = {
            ...results.tables as object,
            bills: {
                exists: !billsError,
                error: billsError?.message || null,
                code: billsError?.code || null,
                count: bills?.length || 0,
            },
        };

        // Check salons table (should always exist)
        const { data: salon, error: salonError } = await supabase
            .from('salons')
            .select('id, name')
            .eq('id', session.salonId)
            .single();

        results.tables = {
            ...results.tables as object,
            salons: {
                exists: !salonError,
                error: salonError?.message || null,
                code: salonError?.code || null,
                salonName: salon?.name || null,
            },
        };

        // Test insert capability on products
        const testInsertResult = await supabase
            .from('products')
            .insert({
                salon_id: session.salonId,
                name: '__test_product_delete_me__',
                type: 'service_use',
                unit: 'pcs',
            })
            .select()
            .single();

        if (testInsertResult.error) {
            results.insertTest = {
                success: false,
                error: testInsertResult.error.message,
                code: testInsertResult.error.code,
                hint: testInsertResult.error.hint || null,
                details: testInsertResult.error.details || null,
            };
        } else {
            // Delete the test product
            await supabase
                .from('products')
                .delete()
                .eq('id', testInsertResult.data.id);

            results.insertTest = {
                success: true,
                message: 'Insert and delete test passed',
            };
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Schema check error:', error);
        return NextResponse.json({
            error: 'Schema check failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
