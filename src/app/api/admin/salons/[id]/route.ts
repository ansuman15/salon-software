/**
 * Admin Salon Actions API
 * Regenerate key, suspend, reactivate, force logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateActivationKey, hashActivationKey, getKeyExpiryDate, AUTH_ACTIONS } from '@/lib/authUtils';
import { ADMIN_EMAILS } from '@/lib/config';
import { cookies } from 'next/headers';

// Verify admin access
async function verifyAdmin(): Promise<{ isAdmin: boolean; email?: string }> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('salonx_session');

    if (!sessionCookie) return { isAdmin: false };

    try {
        const session = JSON.parse(sessionCookie.value);
        if (ADMIN_EMAILS.includes(session.email)) {
            return { isAdmin: true, email: session.email };
        }
    } catch {
        return { isAdmin: false };
    }

    return { isAdmin: false };
}

// PATCH - Update salon status (suspend/reactivate) or regenerate key
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { isAdmin, email: adminEmail } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const { action } = await request.json();
        const supabase = getSupabaseAdmin();

        // Verify salon exists
        const { data: salon, error: salonError } = await supabase
            .from('salons')
            .select('*')
            .eq('id', id)
            .single();

        if (salonError || !salon) {
            return NextResponse.json({ error: 'Salon not found' }, { status: 404 });
        }

        switch (action) {
            case 'suspend': {
                await supabase
                    .from('salons')
                    .update({ status: 'suspended', suspended_at: new Date().toISOString() })
                    .eq('id', id);

                // Revoke all active keys
                await supabase
                    .from('activation_keys')
                    .update({ status: 'revoked' })
                    .eq('salon_id', id)
                    .eq('status', 'active');

                // Log action
                await supabase.from('admin_audit_logs').insert({
                    admin_id: '00000000-0000-0000-0000-000000000000',
                    action: AUTH_ACTIONS.SALON_SUSPENDED,
                    target_type: 'salon',
                    target_id: id,
                    metadata: { admin_email: adminEmail },
                });

                return NextResponse.json({ success: true, message: 'Salon suspended' });
            }

            case 'reactivate': {
                await supabase
                    .from('salons')
                    .update({ status: 'active', suspended_at: null })
                    .eq('id', id);

                // Log action
                await supabase.from('admin_audit_logs').insert({
                    admin_id: '00000000-0000-0000-0000-000000000000',
                    action: AUTH_ACTIONS.SALON_REACTIVATED,
                    target_type: 'salon',
                    target_id: id,
                    metadata: { admin_email: adminEmail },
                });

                return NextResponse.json({ success: true, message: 'Salon reactivated' });
            }

            case 'regenerate-key': {
                // Revoke old keys
                await supabase
                    .from('activation_keys')
                    .update({ status: 'revoked' })
                    .eq('salon_id', id)
                    .eq('status', 'active');

                // Generate new key
                const plainKey = generateActivationKey();
                const keyHash = await hashActivationKey(plainKey);
                const expiresAt = getKeyExpiryDate(72);

                await supabase.from('activation_keys').insert({
                    salon_id: id,
                    key_hash: keyHash,
                    status: 'active',
                    expires_at: expiresAt.toISOString(),
                    created_by_admin: '00000000-0000-0000-0000-000000000000',
                });

                // Activate salon if inactive
                if (salon.status === 'inactive') {
                    await supabase
                        .from('salons')
                        .update({ status: 'active' })
                        .eq('id', id);
                }

                // Log action
                await supabase.from('admin_audit_logs').insert({
                    admin_id: '00000000-0000-0000-0000-000000000000',
                    action: AUTH_ACTIONS.ACTIVATION_KEY_REGENERATED,
                    target_type: 'salon',
                    target_id: id,
                    metadata: { admin_email: adminEmail },
                });

                return NextResponse.json({
                    success: true,
                    activationKey: plainKey,
                    expiresAt: expiresAt.toISOString(),
                    message: 'New activation key generated. Copy it now!',
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('[Admin Salon Actions] Error:', error);
        return NextResponse.json({ error: 'Action failed' }, { status: 500 });
    }
}

// DELETE - Remove salon entirely
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
        .from('salons')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Salon deleted' });
}
