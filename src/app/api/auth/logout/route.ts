/**
 * Logout API
 * Clears all session cookies (both formats)
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/sessionHelper';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    await clearSessionCookies();
    return NextResponse.json({ success: true });
}
