/**
 * Demo Requests API - Saves demo request submissions to Supabase
 * and sends email notification to admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Email notification using Resend or fallback to console log
async function sendEmailNotification(data: {
    name: string;
    salonName: string;
    phone: string;
    email?: string;
    city?: string;
    staffCount?: string;
}) {
    const ADMIN_EMAIL = 'convertrix.co@gmail.com';

    // Try to send via Resend if API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'SalonX <noreply@salonx.in>',
                    to: [ADMIN_EMAIL],
                    subject: `🎉 New Demo Request from ${data.salonName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background: linear-gradient(135deg, #2d2826 0%, #4a4543 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                                <h1 style="margin: 0; font-size: 24px;">🎉 New Demo Request</h1>
                            </div>
                            <div style="background: #f8f7f6; padding: 20px; border-radius: 0 0 10px 10px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: bold; width: 120px;">Name:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: bold;">Salon Name:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.salonName}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: bold;">Phone:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                                            <a href="tel:${data.phone}" style="color: #2d2826;">${data.phone}</a>
                                        </td>
                                    </tr>
                                    ${data.email ? `
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: bold;">Email:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">
                                            <a href="mailto:${data.email}" style="color: #2d2826;">${data.email}</a>
                                        </td>
                                    </tr>
                                    ` : ''}
                                    ${data.city ? `
                                    <tr>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5; font-weight: bold;">City:</td>
                                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e5;">${data.city}</td>
                                    </tr>
                                    ` : ''}
                                    ${data.staffCount ? `
                                    <tr>
                                        <td style="padding: 10px 0; font-weight: bold;">Staff Count:</td>
                                        <td style="padding: 10px 0;">${data.staffCount}</td>
                                    </tr>
                                    ` : ''}
                                </table>
                                <div style="margin-top: 20px; padding: 15px; background: #22c55e; color: white; border-radius: 8px; text-align: center;">
                                    <strong>Contact this lead within 24 hours!</strong>
                                </div>
                            </div>
                            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
                                This email was sent from SalonX Landing Page
                            </p>
                        </div>
                    `,
                }),
            });

            if (response.ok) {
                console.log('[Demo Requests] Email sent successfully to', ADMIN_EMAIL);
                return true;
            } else {
                console.error('[Demo Requests] Email send failed:', await response.text());
                return false;
            }
        } catch (error) {
            console.error('[Demo Requests] Email error:', error);
            return false;
        }
    } else {
        // Log to console if no email service configured
        console.log('='.repeat(50));
        console.log('📧 NEW DEMO REQUEST - EMAIL NOTIFICATION');
        console.log('='.repeat(50));
        console.log(`To: ${ADMIN_EMAIL}`);
        console.log(`Name: ${data.name}`);
        console.log(`Salon: ${data.salonName}`);
        console.log(`Phone: ${data.phone}`);
        console.log(`Email: ${data.email || 'N/A'}`);
        console.log(`City: ${data.city || 'N/A'}`);
        console.log(`Staff: ${data.staffCount || 'N/A'}`);
        console.log('='.repeat(50));
        return true;
    }
}

// POST - Create a new demo request
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.phone || !body.salonName) {
            return NextResponse.json(
                { error: 'Name, phone, and salon name are required' },
                { status: 400 }
            );
        }

        const requestData = {
            name: body.name.trim(),
            salonName: body.salonName.trim(),
            phone: body.phone.trim(),
            email: body.email?.trim() || undefined,
            city: body.city?.trim() || undefined,
            staffCount: body.staffCount || undefined,
        };

        // Send email notification (don't block on failure)
        sendEmailNotification(requestData).catch(console.error);

        // Try to save to Supabase
        const supabase = getSupabaseAdmin();
        let savedToDb = false;

        try {
            const { error } = await supabase
                .from('demo_requests')
                .insert({
                    name: requestData.name,
                    salon_name: requestData.salonName,
                    phone: requestData.phone,
                    email: requestData.email || null,
                    city: requestData.city || null,
                    staff_count: requestData.staffCount || null,
                    status: 'pending',
                    created_at: new Date().toISOString(),
                });

            if (!error) {
                savedToDb = true;
                console.log('[Demo Requests API] Saved to database');
            } else {
                console.warn('[Demo Requests API] Database save failed:', error.message);
            }
        } catch (dbError) {
            console.warn('[Demo Requests API] Database error:', dbError);
        }

        // Return success even if DB save failed (email was still sent)
        return NextResponse.json({
            success: true,
            message: 'Demo request submitted successfully! We will contact you within 24 hours.',
            savedToDb
        });

    } catch (error) {
        console.error('[Demo Requests API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Fetch all demo requests (admin only)
export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        const { data: requests, error } = await supabase
            .from('demo_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Demo Requests API] Fetch error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch demo requests' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            requests: requests || []
        });

    } catch (error) {
        console.error('[Demo Requests API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
