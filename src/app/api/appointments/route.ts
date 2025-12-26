/**
 * Appointments API - CRUD operations for Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Fetch all appointments for the salon
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salonId;

        if (!salonId || salonId === 'admin') {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();
        const { data: appointments, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('salon_id', salonId)
            .order('appointment_date', { ascending: false });

        if (error) {
            console.error('[Appointments API] Error fetching:', error);
            return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 });
        }

        // Transform snake_case to camelCase
        const transformedAppointments = (appointments || []).map(a => ({
            id: a.id,
            salonId: a.salon_id,
            customerId: a.customer_id,
            staffId: a.staff_id,
            appointmentDate: a.appointment_date,
            startTime: a.start_time,
            endTime: a.end_time,
            status: a.status,
            serviceIds: a.service_ids || [],
            notes: a.notes,
            createdAt: a.created_at,
        }));

        return NextResponse.json({ appointments: transformedAppointments });

    } catch (error) {
        console.error('[Appointments API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new appointment
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salonId;

        if (!salonId || salonId === 'admin') {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const body = await request.json();
        const { customerId, staffId, appointmentDate, startTime, endTime, serviceIds, notes, customerName, customerPhone } = body;

        if (!staffId || !appointmentDate || !startTime || !serviceIds || serviceIds.length === 0) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        let finalCustomerId = customerId;

        // Create new customer if needed
        if (!finalCustomerId && customerName && customerPhone) {
            const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                    salon_id: salonId,
                    name: customerName,
                    phone: customerPhone,
                    tags: ['New'],
                    created_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (customerError) {
                console.error('[Appointments API] Customer creation error:', customerError);
                return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
            }
            finalCustomerId = newCustomer.id;
        }

        if (!finalCustomerId) {
            return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
        }

        // Create appointment
        const { data: appointment, error } = await supabase
            .from('appointments')
            .insert({
                salon_id: salonId,
                customer_id: finalCustomerId,
                staff_id: staffId,
                appointment_date: appointmentDate,
                start_time: startTime,
                end_time: endTime,
                status: 'confirmed',
                service_ids: serviceIds,
                notes: notes || null,
                created_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('[Appointments API] Insert error:', error);
            return NextResponse.json({ error: 'Failed to create appointment: ' + error.message }, { status: 500 });
        }

        // Transform response
        const transformedAppointment = {
            id: appointment.id,
            salonId: appointment.salon_id,
            customerId: appointment.customer_id,
            staffId: appointment.staff_id,
            appointmentDate: appointment.appointment_date,
            startTime: appointment.start_time,
            endTime: appointment.end_time,
            status: appointment.status,
            serviceIds: appointment.service_ids || [],
            notes: appointment.notes,
            createdAt: appointment.created_at,
        };

        return NextResponse.json({
            success: true,
            appointment: transformedAppointment,
            customerId: finalCustomerId
        });

    } catch (error) {
        console.error('[Appointments API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT - Update an appointment
export async function PUT(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('salonx_session');

        if (!sessionCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const session = JSON.parse(sessionCookie.value);
        const salonId = session.salonId;

        if (!salonId || salonId === 'admin') {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const body = await request.json();
        const { id, staffId, appointmentDate, startTime, endTime, serviceIds, notes, status } = body;

        if (!id) {
            return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Build update object
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (staffId) updateData.staff_id = staffId;
        if (appointmentDate) updateData.appointment_date = appointmentDate;
        if (startTime) updateData.start_time = startTime;
        if (endTime) updateData.end_time = endTime;
        if (serviceIds) updateData.service_ids = serviceIds;
        if (notes !== undefined) updateData.notes = notes;
        if (status) updateData.status = status;

        const { data: appointment, error } = await supabase
            .from('appointments')
            .update(updateData)
            .eq('id', id)
            .eq('salon_id', salonId)
            .select()
            .single();

        if (error) {
            console.error('[Appointments API] Update error:', error);
            return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
        }

        // Transform response
        const transformedAppointment = {
            id: appointment.id,
            salonId: appointment.salon_id,
            customerId: appointment.customer_id,
            staffId: appointment.staff_id,
            appointmentDate: appointment.appointment_date,
            startTime: appointment.start_time,
            endTime: appointment.end_time,
            status: appointment.status,
            serviceIds: appointment.service_ids || [],
            notes: appointment.notes,
            createdAt: appointment.created_at,
        };

        return NextResponse.json({
            success: true,
            appointment: transformedAppointment
        });

    } catch (error) {
        console.error('[Appointments API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
