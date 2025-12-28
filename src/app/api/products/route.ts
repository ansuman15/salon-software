import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, DbProduct } from '@/lib/supabase';
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
 * GET /api/products
 * List all products for the salon
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const type = searchParams.get('type');
        const activeOnly = searchParams.get('active') !== 'false';

        const supabase = getSupabaseAdmin();
        let query = supabase
            .from('products')
            .select('*')
            .eq('salon_id', session.salonId)
            .order('name', { ascending: true });

        if (category) {
            query = query.eq('category', category);
        }
        if (type) {
            query = query.eq('type', type);
        }
        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Products GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.salonId) {
            console.error('[Products API] No session found');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.error('[Products API] JSON parse error:', parseError);
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        console.log('[Products API] Creating product:', {
            name: body.name,
            type: body.type,
            unit: body.unit,
            salonId: session.salonId
        });

        const { name, category, brand, type, unit, cost_price, selling_price, image_url } = body;

        if (!name || !type || !unit) {
            return NextResponse.json(
                { error: 'Name, type, and unit are required' },
                { status: 400 }
            );
        }

        if (!['service_use', 'retail_sale', 'both'].includes(type)) {
            return NextResponse.json(
                { error: 'Type must be service_use, retail_sale, or both' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Build insert data - explicitly handle empty strings
        // NOTE: image_url column needs to be added to Supabase products table
        // For now, we skip it to allow product creation to work
        const insertData: Record<string, unknown> = {
            salon_id: session.salonId,
            name: name.trim(),
            category: category && category.trim() ? category.trim() : null,
            brand: brand && brand.trim() ? brand.trim() : null,
            type,
            unit,
            cost_price: cost_price ? Number(cost_price) : null,
            selling_price: selling_price ? Number(selling_price) : null,
            // TODO: Add image_url column to Supabase products table, then uncomment:
            // image_url: image_url && image_url.trim() ? image_url.trim() : null,
        };

        console.log('[Products API] Insert data:', insertData);

        const { data, error } = await supabase
            .from('products')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('[Products API] Supabase INSERT error:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            return NextResponse.json(
                {
                    error: error.message || 'Database error',
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                },
                { status: 500 }
            );
        }

        console.log('[Products API] Product created successfully:', data.id);

        return NextResponse.json({
            success: true,
            data,
            message: 'Product created successfully'
        });
    } catch (error) {
        console.error('[Products API] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create product';
        return NextResponse.json({ error: errorMessage, type: 'unexpected' }, { status: 500 });
    }
}
