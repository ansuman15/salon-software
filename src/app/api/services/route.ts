/**
 * Services API - CRUD operations for Supabase
 * Secure endpoints for managing salon services
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
    verifySession,
    unauthorizedResponse,
    badRequestResponse,
    serverErrorResponse,
    successResponse,
    sanitizeString,
    requireString,
    requirePositiveNumber,
} from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET - Fetch all services for the salon
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const supabase = getSupabaseAdmin();
        const { data: services, error } = await supabase
            .from('services')
            .select('*')
            .eq('salon_id', session.salonId)
            .order('category', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            console.error('[Services API] Fetch error:', error);
            return serverErrorResponse('Failed to fetch services');
        }

        // Transform snake_case to camelCase
        const transformedServices = (services || []).map(s => ({
            id: s.id,
            salonId: s.salon_id,
            name: s.name,
            category: s.category,
            durationMinutes: s.duration_minutes,
            price: s.price,
            description: s.description,
            imageUrl: s.image_url,
            isActive: s.is_active,
            createdAt: s.created_at,
        }));

        return successResponse({ services: transformedServices });

    } catch (error) {
        console.error('[Services API] Error:', error);
        return serverErrorResponse();
    }
}

// POST - Create a new service
export async function POST(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const body = await request.json();

        // Validate required fields
        const nameResult = requireString(body.name, 'Service name');
        if (nameResult.error) {
            return badRequestResponse(nameResult.error);
        }

        const categoryResult = requireString(body.category, 'Category');
        if (categoryResult.error) {
            return badRequestResponse(categoryResult.error);
        }

        const durationResult = requirePositiveNumber(body.durationMinutes, 'Duration');
        if (durationResult.error || durationResult.value < 5) {
            return badRequestResponse('Duration must be at least 5 minutes');
        }

        const priceResult = requirePositiveNumber(body.price, 'Price');
        if (priceResult.error) {
            return badRequestResponse(priceResult.error);
        }

        const supabase = getSupabaseAdmin();

        const { data: service, error } = await supabase
            .from('services')
            .insert({
                salon_id: session.salonId,
                name: nameResult.value,
                category: categoryResult.value,
                duration_minutes: durationResult.value,
                price: priceResult.value,
                description: sanitizeString(body.description) || null,
                image_url: sanitizeString(body.imageUrl) || null,
                is_active: true,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[Services API] Insert error:', error);
            return serverErrorResponse('Failed to create service');
        }

        const transformedService = {
            id: service.id,
            salonId: service.salon_id,
            name: service.name,
            category: service.category,
            durationMinutes: service.duration_minutes,
            price: service.price,
            description: service.description,
            imageUrl: service.image_url,
            isActive: service.is_active,
            createdAt: service.created_at,
        };

        return successResponse({ service: transformedService });

    } catch (error) {
        console.error('[Services API] Error:', error);
        return serverErrorResponse();
    }
}

// PUT - Update a service
export async function PUT(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const body = await request.json();

        if (!body.id) {
            return badRequestResponse('Service ID is required');
        }

        const supabase = getSupabaseAdmin();

        // Build update object with only provided fields
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) {
            const nameResult = requireString(body.name, 'Service name');
            if (nameResult.error) return badRequestResponse(nameResult.error);
            updateData.name = nameResult.value;
        }

        if (body.category !== undefined) {
            updateData.category = sanitizeString(body.category);
        }

        if (body.durationMinutes !== undefined) {
            const durationResult = requirePositiveNumber(body.durationMinutes, 'Duration');
            if (durationResult.value < 5) return badRequestResponse('Duration must be at least 5 minutes');
            updateData.duration_minutes = durationResult.value;
        }

        if (body.price !== undefined) {
            updateData.price = requirePositiveNumber(body.price, 'Price').value;
        }

        if (body.description !== undefined) {
            updateData.description = sanitizeString(body.description) || null;
        }

        if (body.imageUrl !== undefined) {
            updateData.image_url = sanitizeString(body.imageUrl) || null;
        }

        if (body.isActive !== undefined) {
            updateData.is_active = Boolean(body.isActive);
        }

        const { data: service, error } = await supabase
            .from('services')
            .update(updateData)
            .eq('id', body.id)
            .eq('salon_id', session.salonId) // Security: only update own services
            .select()
            .single();

        if (error) {
            console.error('[Services API] Update error:', error);
            return serverErrorResponse('Failed to update service');
        }

        const transformedService = {
            id: service.id,
            salonId: service.salon_id,
            name: service.name,
            category: service.category,
            durationMinutes: service.duration_minutes,
            price: service.price,
            description: service.description,
            imageUrl: service.image_url,
            isActive: service.is_active,
            createdAt: service.created_at,
        };

        return successResponse({ service: transformedService });

    } catch (error) {
        console.error('[Services API] Error:', error);
        return serverErrorResponse();
    }
}

// DELETE - Permanently delete a service
export async function DELETE(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return badRequestResponse('Service ID is required');
        }

        const supabase = getSupabaseAdmin();

        // Permanent delete
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id)
            .eq('salon_id', session.salonId); // Security: only delete own services

        if (error) {
            console.error('[Services API] Delete error:', error);
            return serverErrorResponse('Failed to delete service');
        }

        return successResponse({ deleted: true });

    } catch (error) {
        console.error('[Services API] Error:', error);
        return serverErrorResponse();
    }
}
