/**
 * Staff API - CRUD operations for Supabase
 * Secure endpoints for managing salon staff members
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
    validateStringArray,
} from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET - Fetch all staff for the salon
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const supabase = getSupabaseAdmin();
        const { data: staff, error } = await supabase
            .from('staff')
            .select('*')
            .eq('salon_id', session.salonId)
            .order('name', { ascending: true });

        if (error) {
            console.error('[Staff API] Fetch error:', error);
            return serverErrorResponse('Failed to fetch staff');
        }

        // Transform snake_case to camelCase
        const transformedStaff = (staff || []).map(s => ({
            id: s.id,
            salonId: s.salon_id,
            name: s.name,
            phone: s.phone,
            role: s.role,
            imageUrl: s.image_url,
            isActive: s.is_active,
            serviceIds: s.service_ids || [],
            createdAt: s.created_at,
        }));

        return successResponse({ staff: transformedStaff });

    } catch (error) {
        console.error('[Staff API] Error:', error);
        return serverErrorResponse();
    }
}

// POST - Create a new staff member
export async function POST(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const body = await request.json();

        // Validate required fields
        const nameResult = requireString(body.name, 'Staff name');
        if (nameResult.error) {
            return badRequestResponse(nameResult.error);
        }

        const roleResult = requireString(body.role, 'Role');
        if (roleResult.error) {
            return badRequestResponse(roleResult.error);
        }

        const supabase = getSupabaseAdmin();

        const { data: staffMember, error } = await supabase
            .from('staff')
            .insert({
                salon_id: session.salonId,
                name: nameResult.value,
                role: roleResult.value,
                phone: sanitizeString(body.phone) || null,
                image_url: body.imageUrl || null, // Base64 or URL
                is_active: true,
                service_ids: validateStringArray(body.serviceIds),
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[Staff API] Insert error:', error);
            return serverErrorResponse('Failed to create staff member');
        }

        const transformedStaff = {
            id: staffMember.id,
            salonId: staffMember.salon_id,
            name: staffMember.name,
            phone: staffMember.phone,
            role: staffMember.role,
            imageUrl: staffMember.image_url,
            isActive: staffMember.is_active,
            serviceIds: staffMember.service_ids || [],
            createdAt: staffMember.created_at,
        };

        return successResponse({ staff: transformedStaff });

    } catch (error) {
        console.error('[Staff API] Error:', error);
        return serverErrorResponse();
    }
}

// PUT - Update a staff member
export async function PUT(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const body = await request.json();

        if (!body.id) {
            return badRequestResponse('Staff ID is required');
        }

        const supabase = getSupabaseAdmin();

        // Build update object with only provided fields
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) {
            const nameResult = requireString(body.name, 'Staff name');
            if (nameResult.error) return badRequestResponse(nameResult.error);
            updateData.name = nameResult.value;
        }

        if (body.role !== undefined) {
            updateData.role = sanitizeString(body.role);
        }

        if (body.phone !== undefined) {
            updateData.phone = sanitizeString(body.phone) || null;
        }

        if (body.imageUrl !== undefined) {
            updateData.image_url = body.imageUrl || null;
        }

        if (body.isActive !== undefined) {
            updateData.is_active = Boolean(body.isActive);
        }

        if (body.serviceIds !== undefined) {
            updateData.service_ids = validateStringArray(body.serviceIds);
        }

        const { data: staffMember, error } = await supabase
            .from('staff')
            .update(updateData)
            .eq('id', body.id)
            .eq('salon_id', session.salonId) // Security: only update own staff
            .select()
            .single();

        if (error) {
            console.error('[Staff API] Update error:', error);
            return serverErrorResponse('Failed to update staff member');
        }

        const transformedStaff = {
            id: staffMember.id,
            salonId: staffMember.salon_id,
            name: staffMember.name,
            phone: staffMember.phone,
            role: staffMember.role,
            imageUrl: staffMember.image_url,
            isActive: staffMember.is_active,
            serviceIds: staffMember.service_ids || [],
            createdAt: staffMember.created_at,
        };

        return successResponse({ staff: transformedStaff });

    } catch (error) {
        console.error('[Staff API] Error:', error);
        return serverErrorResponse();
    }
}

// DELETE - Soft delete (deactivate) a staff member
export async function DELETE(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return unauthorizedResponse();
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return badRequestResponse('Staff ID is required');
        }

        const supabase = getSupabaseAdmin();

        // Soft delete by setting is_active to false
        const { error } = await supabase
            .from('staff')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('salon_id', session.salonId); // Security: only delete own staff

        if (error) {
            console.error('[Staff API] Delete error:', error);
            return serverErrorResponse('Failed to delete staff member');
        }

        return successResponse({ deleted: true });

    } catch (error) {
        console.error('[Staff API] Error:', error);
        return serverErrorResponse();
    }
}
