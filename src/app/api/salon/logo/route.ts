import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        // Get session from cookie
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salon?.id;

        if (!salonId) {
            return NextResponse.json({ error: 'Salon not found' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the form data with the image
        const formData = await request.formData();
        const file = formData.get('logo') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File must be less than 5MB' }, { status: 400 });
        }

        // Create unique filename
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${salonId}/logo.${fileExt}`;

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('salon-logos')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: true, // Overwrite if exists
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('salon-logos')
            .getPublicUrl(fileName);

        // Update salon with logo URL
        const { error: updateError } = await supabase
            .from('salons')
            .update({ logo_url: publicUrl })
            .eq('id', salonId);

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update salon' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            logo_url: publicUrl
        });

    } catch (error) {
        console.error('Logo upload error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        // Get session from cookie
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie?.value) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salon?.id;

        if (!salonId) {
            return NextResponse.json({ error: 'Salon not found' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Remove logo_url from salon
        const { error: updateError } = await supabase
            .from('salons')
            .update({ logo_url: null })
            .eq('id', salonId);

        if (updateError) {
            console.error('Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update salon' }, { status: 500 });
        }

        // Try to delete the file from storage (don't fail if it doesn't exist)
        await supabase.storage
            .from('salon-logos')
            .remove([`${salonId}/logo.jpg`, `${salonId}/logo.png`, `${salonId}/logo.jpeg`]);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Logo delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
