/**
 * Individual Customer API - Update and Delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getApiSession } from '@/lib/sessionHelper';

export const dynamic = 'force-dynamic';

// PATCH - Update a customer
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiSession();
        if (!session?.salonId) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const supabase = getSupabaseAdmin();

        // Verify customer belongs to this salon
        const { data: existing, error: fetchError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (fetchError || !existing) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Update customer
        const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };

        if (body.name !== undefined) updateData.name = body.name;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.email !== undefined) updateData.email = body.email;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.tags !== undefined) updateData.tags = body.tags;
        if (body.gender !== undefined) updateData.gender = body.gender;

        const { data: updated, error: updateError } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[Customer API] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
        }

        // Transform to camelCase
        const customer = {
            id: updated.id,
            salonId: updated.salon_id,
            name: updated.name,
            phone: updated.phone,
            email: updated.email,
            gender: updated.gender,
            notes: updated.notes,
            tags: updated.tags || [],
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
        };

        return NextResponse.json({ success: true, customer });

    } catch (error) {
        console.error('[Customer API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete a customer
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiSession();
        if (!session?.salonId) {
            console.error('[Customer DELETE] No session found');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { id } = await params;
        console.log('[Customer DELETE] Deleting customer:', id, 'for salon:', session.salonId);

        const supabase = getSupabaseAdmin();

        // Verify customer belongs to this salon
        const { data: existing, error: fetchError } = await supabase
            .from('customers')
            .select('id, name')
            .eq('id', id)
            .eq('salon_id', session.salonId)
            .single();

        if (fetchError) {
            console.error('[Customer DELETE] Fetch error:', fetchError);
            return NextResponse.json({ error: 'Customer not found or access denied' }, { status: 404 });
        }

        if (!existing) {
            console.error('[Customer DELETE] Customer not found:', id);
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        console.log('[Customer DELETE] Found customer:', existing.name);

        // First, delete related records to avoid foreign key constraint violations
        // Order matters: delete from child tables first, then parent

        // 1. Get all bills for this customer to delete their payments first
        const { data: customerBills } = await supabase
            .from('bills')
            .select('id')
            .eq('customer_id', id);

        if (customerBills && customerBills.length > 0) {
            const billIds = customerBills.map(b => b.id);
            console.log('[Customer DELETE] Deleting payments for', billIds.length, 'bills');

            // Delete payments for these bills
            const { error: paymentsError } = await supabase
                .from('payments')
                .delete()
                .in('bill_id', billIds);

            if (paymentsError) {
                console.error('[Customer DELETE] Error deleting payments:', paymentsError);
            }
        }

        // 2. Delete bills for this customer
        const { error: billsError } = await supabase
            .from('bills')
            .delete()
            .eq('customer_id', id);

        if (billsError) {
            console.error('[Customer DELETE] Error deleting bills:', billsError);
            // Continue anyway - bills might not exist
        }

        // 3. Get all appointments for this customer to delete related services first
        const { data: customerAppointments } = await supabase
            .from('appointments')
            .select('id')
            .eq('customer_id', id);

        if (customerAppointments && customerAppointments.length > 0) {
            const appointmentIds = customerAppointments.map(a => a.id);
            console.log('[Customer DELETE] Deleting appointment_services for', appointmentIds.length, 'appointments');

            // Delete appointment_services for these appointments
            const { error: appointmentServicesError } = await supabase
                .from('appointment_services')
                .delete()
                .in('appointment_id', appointmentIds);

            if (appointmentServicesError) {
                console.error('[Customer DELETE] Error deleting appointment_services:', appointmentServicesError);
            }
        }

        // 4. Delete appointments for this customer
        const { error: appointmentsError } = await supabase
            .from('appointments')
            .delete()
            .eq('customer_id', id);

        if (appointmentsError) {
            console.error('[Customer DELETE] Error deleting appointments:', appointmentsError);
        }

        // 5. Delete whatsapp_logs for this customer
        const { error: whatsappError } = await supabase
            .from('whatsapp_logs')
            .delete()
            .eq('customer_id', id);

        if (whatsappError) {
            console.error('[Customer DELETE] Error deleting whatsapp_logs:', whatsappError);
        }

        // 6. Delete customer_preferences (has onDelete: Cascade, but let's be explicit)
        const { error: prefsError } = await supabase
            .from('customer_preferences')
            .delete()
            .eq('customer_id', id);

        if (prefsError) {
            console.error('[Customer DELETE] Error deleting customer_preferences:', prefsError);
        }

        // Now delete the customer - all related records should be gone
        const { error: deleteError } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('salon_id', session.salonId);

        if (deleteError) {
            console.error('[Customer DELETE] Supabase delete error:', {
                message: deleteError.message,
                code: deleteError.code,
                details: deleteError.details,
                hint: deleteError.hint
            });
            return NextResponse.json({
                error: deleteError.message || 'Failed to delete customer',
                code: deleteError.code
            }, { status: 500 });
        }

        console.log('[Customer DELETE] Successfully deleted:', id);
        return NextResponse.json({ success: true, message: 'Customer deleted' });

    } catch (error) {
        console.error('[Customer DELETE] Unexpected error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
