/**
 * Health Check API Route
 * GET /api/health
 * 
 * Used by load balancers and monitoring tools to verify application status
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
    const startTime = Date.now();

    let dbStatus = 'unknown';
    let dbLatency = null;

    try {
        // Test database connection
        const supabase = getSupabaseClient();
        const dbStart = Date.now();
        const { error } = await supabase.from('salons').select('id').limit(1);
        dbLatency = Date.now() - dbStart;

        if (error) {
            dbStatus = 'error';
        } else {
            dbStatus = 'connected';
        }
    } catch {
        dbStatus = 'disconnected';
    }

    const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '0.1.0',
        environment: process.env.NODE_ENV,
        database: {
            status: dbStatus,
            latency_ms: dbLatency,
        },
        responseTime_ms: Date.now() - startTime,
    };

    return NextResponse.json(response, {
        status: dbStatus === 'connected' ? 200 : 503,
    });
}
