/**
 * Logout API
 * Clears session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    cookieStore.delete('salonx_session');

    return NextResponse.json({ success: true });
}
