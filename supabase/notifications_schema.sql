-- Notifications System Schema
-- Run this in Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('appointment_created', 'appointment_reminder', 'payment_received', 'low_stock', 'staff_activity', 'system')),
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_salon_id ON public.notifications(salon_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(salon_id, read) WHERE read = FALSE;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their salon's notifications
CREATE POLICY "Users can view own salon notifications"
    ON public.notifications FOR SELECT
    USING (
        salon_id IN (
            SELECT id FROM public.salons 
            WHERE user_id = auth.uid()
        )
    );

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own salon notifications"
    ON public.notifications FOR UPDATE
    USING (
        salon_id IN (
            SELECT id FROM public.salons 
            WHERE user_id = auth.uid()
        )
    );

-- Service role can insert notifications (for system triggers)
CREATE POLICY "Service role can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- Function to create notification on appointment creation
CREATE OR REPLACE FUNCTION notify_appointment_created()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (salon_id, type, title, message)
    VALUES (
        NEW.salon_id,
        'appointment_created',
        'New Appointment Booked',
        'Appointment scheduled for ' || to_char(NEW.date::date, 'Mon DD') || ' at ' || NEW.time
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for appointment notifications
DROP TRIGGER IF EXISTS trigger_notify_appointment_created ON public.appointments;
CREATE TRIGGER trigger_notify_appointment_created
    AFTER INSERT ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION notify_appointment_created();

-- Function to create notification on payment
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (salon_id, type, title, message)
    VALUES (
        NEW.salon_id,
        'payment_received',
        'Payment Received',
        'Payment of ₹' || NEW.total || ' received'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for payment notifications (if invoices table exists)
-- Uncomment if you have invoices table:
-- DROP TRIGGER IF EXISTS trigger_notify_payment_received ON public.invoices;
-- CREATE TRIGGER trigger_notify_payment_received
--     AFTER INSERT ON public.invoices
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_payment_received();
