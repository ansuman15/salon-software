/**
 * Salon API - Get salon info for billing/receipts
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse, serverErrorResponse, successResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET - Fetch salon info for the logged in user
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const supabase = getSupabaseAdmin();
        const { data: salon, error } = await supabase
            .from('salons')
            .select('*')
            .eq('id', session.salonId)
            .single();

        if (error) {
            console.error('[Salon API] Fetch error:', error);
            return serverErrorResponse('Failed to fetch salon');
        }

        // Transform snake_case to camelCase
        const transformedSalon = {
            id: salon.id,
            name: salon.name,
            address: salon.address,
            city: salon.city,
            phone: salon.phone,
            email: salon.owner_email,
            gst_number: salon.gst_number,
            gst_percentage: salon.gst_percentage || 0,
            logoUrl: salon.logo_url,
            status: salon.status,
            createdAt: salon.created_at,
        };

        return successResponse({ salon: transformedSalon });

    } catch (error) {
        console.error('[Salon API] Error:', error);
        return serverErrorResponse();
    }
}
