/**
 * SalonX Login API
 * Server-side authentication with activation key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyActivationKey, isValidKeyFormat, checkRateLimit, resetRateLimit, AUTH_ACTIONS } from '@/lib/authUtils';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const { email, activationKey } = await request.json();

        // Validate inputs
        if (!email || !activationKey) {
            return NextResponse.json(
                { error: 'Email and activation key are required' },
                { status: 400 }
            );
        }

        const trimmedEmail = email.trim().toLowerCase();
        const trimmedKey = activationKey.trim().toUpperCase();

        // Rate limiting
        const rateCheck = checkRateLimit(trimmedEmail);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: `Too many login attempts. Please try again in ${Math.ceil(rateCheck.retryAfter! / 60)} minutes.` },
                { status: 429 }
            );
        }

        // Validate key format before DB lookup
        if (!isValidKeyFormat(trimmedKey)) {
            await logAuthAttempt(trimmedEmail, null, false, 'Invalid key format');
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        const supabase = getSupabaseAdmin();

        // 1. Find salon by owner_email
        const { data: salon, error: salonError } = await supabase
            .from('salons')
            .select('*')
            .eq('owner_email', trimmedEmail)
            .single();

        if (salonError || !salon) {
            await logAuthAttempt(trimmedEmail, null, false, 'Salon not found');
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 2. Check salon status
        if (salon.status !== 'active') {
            await logAuthAttempt(trimmedEmail, salon.id, false, `Salon ${salon.status}`);

            const errorMessage = salon.status === 'suspended'
                ? 'Your account has been suspended. Please contact support.'
                : 'Your account is not yet activated. Please contact support.';

            return NextResponse.json(
                { error: errorMessage },
                { status: 403 }
            );
        }

        // 3. Find active activation key for salon
        const { data: keyRecord, error: keyError } = await supabase
            .from('activation_keys')
            .select('*')
            .eq('salon_id', salon.id)
            .eq('status', 'active')
            .single();

        if (keyError || !keyRecord) {
            await logAuthAttempt(trimmedEmail, salon.id, false, 'No active key');
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 4. Check key expiry
        if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
            // Mark key as expired
            await supabase
                .from('activation_keys')
                .update({ status: 'expired' })
                .eq('id', keyRecord.id);

            await logAuthAttempt(trimmedEmail, salon.id, false, 'Key expired');
            return NextResponse.json(
                { error: 'Your activation key has expired. Please contact support for a new key.' },
                { status: 401 }
            );
        }

        // 5. Verify key hash (bcrypt)
        const isValid = await verifyActivationKey(trimmedKey, keyRecord.key_hash);
        if (!isValid) {
            await logAuthAttempt(trimmedEmail, salon.id, false, 'Invalid key');
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // 6. SUCCESS - Update records
        const now = new Date().toISOString();

        // Update salon last_login_at and activated_at (if first login)
        await supabase
            .from('salons')
            .update({
                last_login_at: now,
                activated_at: salon.activated_at || now,
            })
            .eq('id', salon.id);

        // Log successful login
        await logAuthAttempt(trimmedEmail, salon.id, true, null);

        // Reset rate limit on success
        resetRateLimit(trimmedEmail);

        // 7. Create session cookie
        const sessionData = {
            salonId: salon.id,
            email: trimmedEmail,
            name: salon.name,
            loginTime: now,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        };

        const cookieStore = await cookies();
        cookieStore.set('salonx_session', JSON.stringify(sessionData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60, // 24 hours
            path: '/',
        });

        return NextResponse.json({
            success: true,
            salon: {
                id: salon.id,
                name: salon.name,
                email: salon.owner_email,
            },
        });

    } catch (error) {
        console.error('[Login API] Error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again.' },
            { status: 500 }
        );
    }
}

/**
 * Log authentication attempts for audit trail
 */
async function logAuthAttempt(
    email: string,
    salonId: string | null,
    success: boolean,
    failureReason: string | null
) {
    try {
        const supabase = getSupabaseAdmin();
        await supabase.from('admin_audit_logs').insert({
            admin_id: '00000000-0000-0000-0000-000000000000', // System action
            action: success ? AUTH_ACTIONS.LOGIN_SUCCESS : AUTH_ACTIONS.LOGIN_FAILED,
            target_type: 'salon',
            target_id: salonId || '00000000-0000-0000-0000-000000000000',
            metadata: {
                email,
                success,
                failure_reason: failureReason,
                timestamp: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[Login API] Failed to log auth attempt:', error);
    }
}
