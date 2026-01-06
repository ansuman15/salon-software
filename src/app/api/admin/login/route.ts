import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_EMAILS, ADMIN_CREDENTIALS } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/login
 * Direct admin login without needing a salon
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        console.log('[Admin Login] Attempt with email:', email);
        console.log('[Admin Login] ADMIN_EMAILS:', ADMIN_EMAILS);
        console.log('[Admin Login] ADMIN_CREDENTIALS.email:', ADMIN_CREDENTIALS.email);

        if (!email || !password) {
            console.log('[Admin Login] Missing email or password');
            return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
        }

        // Check if email is in admin list
        if (!ADMIN_EMAILS.includes(email)) {
            console.log('[Admin Login] Email not in admin list:', email);
            return NextResponse.json({ error: 'Unauthorized - email not in admin list' }, { status: 403 });
        }
        console.log('[Admin Login] Email is in admin list');

        // Verify password against admin credentials
        console.log('[Admin Login] Checking credentials...');
        console.log('[Admin Login] Email match:', email === ADMIN_CREDENTIALS.email);
        console.log('[Admin Login] Password match:', password === ADMIN_CREDENTIALS.password);

        if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
            console.log('[Admin Login] Credentials valid, creating session...');
            // Create admin session
            const sessionData = {
                salonId: 'admin',
                salonName: 'SalonX Admin',
                email: email,
                isAdmin: true,
                createdAt: new Date().toISOString(),
            };

            const cookieStore = await cookies();
            cookieStore.set('salonx_session', JSON.stringify(sessionData), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24, // 24 hours
                path: '/',
            });
            console.log('[Admin Login] Session cookie set successfully');

            return NextResponse.json({
                success: true,
                message: 'Admin login successful',
                redirect: '/admin',
            });
        }

        console.log('[Admin Login] Invalid credentials');
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        console.error('Admin login error:', error);
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}
