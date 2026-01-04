/**
 * Admin Salon API
 * Create salons and generate activation keys
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateActivationKey, hashActivationKey, getKeyExpiryDate, AUTH_ACTIONS } from '@/lib/authUtils';
import { ADMIN_EMAILS } from '@/lib/config';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Verify admin access
async function verifyAdmin(): Promise<{ isAdmin: boolean; email?: string }> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');

    if (!sessionCookie) return { isAdmin: false };

    try {
        const session = JSON.parse(sessionCookie.value);
        // Check for isAdmin flag OR email in admin list
        if (session.isAdmin || ADMIN_EMAILS.includes(session.email)) {
            return { isAdmin: true, email: session.email };
        }
    } catch {
        return { isAdmin: false };
    }

    return { isAdmin: false };
}

// GET - List all salons
export async function GET(request: NextRequest) {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: salons, error } = await supabase
        .from('salons')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ salons });
}

// POST - Create new salon with activation key
export async function POST(request: NextRequest) {
    const { isAdmin, email: adminEmail } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { name, ownerEmail, phone, city } = await request.json();

        // Validate required fields
        if (!name || !ownerEmail) {
            return NextResponse.json(
                { error: 'Salon name and owner email are required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Check if salon with this email already exists
        const { data: existing } = await supabase
            .from('salons')
            .select('id')
            .eq('owner_email', ownerEmail.toLowerCase())
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'A salon with this email already exists' },
                { status: 409 }
            );
        }

        // Create salon (active since we're generating activation key)
        const { data: salon, error: salonError } = await supabase
            .from('salons')
            .insert({
                name,
                owner_email: ownerEmail.toLowerCase(),
                phone: phone || null,
                city: city || null,
                status: 'active', // Active - they have an activation key
            })
            .select()
            .single();

        if (salonError) {
            return NextResponse.json({ error: salonError.message }, { status: 500 });
        }

        // Generate activation key
        const plainKey = generateActivationKey();
        const keyHash = await hashActivationKey(plainKey);
        const expiresAt = getKeyExpiryDate(365); // 365 days

        // Store hashed key
        const { error: keyError } = await supabase
            .from('activation_keys')
            .insert({
                salon_id: salon.id,
                key_hash: keyHash,
                status: 'active',
                expires_at: expiresAt.toISOString(),
                created_by_admin: '00000000-0000-0000-0000-000000000000', // System admin
            });

        if (keyError) {
            // Rollback salon creation
            await supabase.from('salons').delete().eq('id', salon.id);
            return NextResponse.json({ error: keyError.message }, { status: 500 });
        }

        // Log admin action (optional - don't fail if table doesn't exist)
        try {
            await supabase.from('admin_audit_logs').insert({
                admin_id: '00000000-0000-0000-0000-000000000000',
                action: AUTH_ACTIONS.SALON_CREATED,
                target_type: 'salon',
                target_id: salon.id,
                metadata: { admin_email: adminEmail, salon_name: name },
            });
        } catch {
            // Audit log is optional, don't fail salon creation
        }

        // Return salon with PLAIN KEY (shown only once!)
        return NextResponse.json({
            success: true,
            salon: {
                id: salon.id,
                name: salon.name,
                ownerEmail: salon.owner_email,
                status: salon.status,
            },
            activationKey: plainKey, // ONLY TIME THIS IS SHOWN
            expiresAt: expiresAt.toISOString(),
            message: 'Salon created! Copy the activation key now - it will not be shown again.',
        });

    } catch (error) {
        console.error('[Admin Salons API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create salon';
        return NextResponse.json(
            { error: errorMessage, details: String(error) },
            { status: 500 }
        );
    }
}
