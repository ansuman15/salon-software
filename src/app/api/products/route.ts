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
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
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
        const { data, error } = await supabase
            .from('products')
            .insert({
                salon_id: session.salonId,
                name,
                category: category || null,
                brand: brand || null,
                type,
                unit,
                cost_price: cost_price || null,
                selling_price: selling_price || null,
                image_url: image_url || null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
            message: 'Product created successfully'
        });
    } catch (error) {
        console.error('Products POST error:', error);
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }
}
