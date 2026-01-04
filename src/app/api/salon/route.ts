/**
 * Salon API - Get salon info for billing/receipts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession, unauthorizedResponse, serverErrorResponse, successResponse, badRequestResponse, sanitizeString } from '@/lib/apiAuth';

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

// PATCH - Update salon profile
export async function PATCH(request: NextRequest) {
    console.log('[Salon API] PATCH request received');
    try {
        const session = await verifySession();
        console.log('[Salon API] Session:', session ? { salonId: session.salonId, email: session.email } : null);

        if (!session) {
            console.log('[Salon API] No session - returning 401');
            return unauthorizedResponse();
        }

        const body = await request.json();
        console.log('[Salon API] Request body:', body);

        const { name, phone, city, address, gst_number, gst_percentage } = body;

        // At least one field should be provided
        if (!name && !phone && !city && !address && gst_number === undefined && gst_percentage === undefined) {
            console.log('[Salon API] No fields to update');
            return badRequestResponse('No fields to update');
        }

        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (name !== undefined) updates.name = sanitizeString(name);
        if (phone !== undefined) updates.phone = sanitizeString(phone) || null;
        if (city !== undefined) updates.city = sanitizeString(city) || null;
        if (address !== undefined) updates.address = sanitizeString(address) || null;
        if (gst_number !== undefined) updates.gst_number = sanitizeString(gst_number) || null;
        if (gst_percentage !== undefined) updates.gst_percentage = Number(gst_percentage) || 0;

        console.log('[Salon API] Updates to apply:', updates);
        console.log('[Salon API] Updating salon ID:', session.salonId);

        const supabase = getSupabaseAdmin();
        const { data: salon, error } = await supabase
            .from('salons')
            .update(updates)
            .eq('id', session.salonId)
            .select()
            .single();

        if (error) {
            console.error('[Salon API] Update error:', error);
            console.error('[Salon API] Error details:', JSON.stringify(error, null, 2));
            return NextResponse.json({
                success: false,
                error: error.message || 'Failed to update salon',
                hint: error.hint,
                details: error.details,
                code: error.code
            }, { status: 500 });
        }

        console.log('[Salon API] Update successful. Salon data:', salon);

        return successResponse({
            salon: {
                id: salon.id,
                name: salon.name,
                address: salon.address,
                city: salon.city,
                phone: salon.phone,
                email: salon.owner_email,
                gst_number: salon.gst_number,
                gst_percentage: salon.gst_percentage || 0,
                logoUrl: salon.logo_url,
            },
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('[Salon API] Unexpected error:', error);
        return serverErrorResponse();
    }
}

