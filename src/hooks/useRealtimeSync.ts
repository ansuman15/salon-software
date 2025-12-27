/**
 * Realtime Sync Hook
 * Subscribes to Supabase Realtime for cross-browser data synchronization
 */

import { useEffect, useRef, useCallback } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { useSession } from '@/lib/SessionContext';

// Create a single Supabase client for realtime subscriptions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// We need the anon key for realtime, but if not available, we'll use polling
const hasRealtimeCredentials = supabaseUrl && supabaseAnonKey;

let realtimeClient: ReturnType<typeof createClient> | null = null;

function getRealtimeClient() {
    if (!hasRealtimeCredentials) return null;
    if (!realtimeClient) {
        realtimeClient = createClient(supabaseUrl!, supabaseAnonKey!);
    }
    return realtimeClient;
}

type TableName = 'appointments' | 'staff' | 'services' | 'customers' | 'products' | 'inventory' | 'attendance';

interface UseRealtimeSyncOptions {
    table: TableName;
    onDataChange: () => void;
    enabled?: boolean;
}

/**
 * Hook to subscribe to realtime changes on a Supabase table
 * When data changes (INSERT, UPDATE, DELETE), it calls onDataChange callback
 * 
 * @param options.table - The table to subscribe to
 * @param options.onDataChange - Callback to refresh data when changes occur
 * @param options.enabled - Whether to enable the subscription (default: true)
 */
export function useRealtimeSync({ table, onDataChange, enabled = true }: UseRealtimeSyncOptions) {
    const { session } = useSession();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const onDataChangeRef = useRef(onDataChange);

    // Keep callback ref updated
    useEffect(() => {
        onDataChangeRef.current = onDataChange;
    }, [onDataChange]);

    useEffect(() => {
        // Don't subscribe if disabled or no session
        const salonId = session?.salon?.id;
        if (!enabled || !salonId) {
            return;
        }

        const client = getRealtimeClient();

        // If no realtime credentials, fall back to polling
        if (!client) {
            console.log(`[Realtime] No anon key configured, using polling for ${table}`);
            const interval = setInterval(() => {
                onDataChangeRef.current();
            }, 30000); // Poll every 30 seconds

            return () => clearInterval(interval);
        }

        // Subscribe to realtime changes
        const channelName = `${table}_${salonId}`;

        channelRef.current = client
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: table,
                    filter: `salon_id=eq.${salonId}`,
                },
                (payload) => {
                    console.log(`[Realtime] ${table} changed:`, payload.eventType);
                    onDataChangeRef.current();
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] ${table} subscription:`, status);
            });

        // Cleanup on unmount
        return () => {
            if (channelRef.current) {
                client.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [table, session?.salon?.id, enabled]);

    // Manual refresh function
    const refresh = useCallback(() => {
        onDataChangeRef.current();
    }, []);

    return { refresh };
}

/**
 * Hook to subscribe to multiple tables at once
 */
export function useMultiRealtimeSync(
    tables: TableName[],
    onDataChange: () => void,
    enabled = true
) {
    const { session } = useSession();

    useEffect(() => {
        const salonId = session?.salon?.id;
        if (!enabled || !salonId) return;

        const client = getRealtimeClient();

        if (!client) {
            // Fall back to polling
            const interval = setInterval(onDataChange, 30000);
            return () => clearInterval(interval);
        }

        const channels: RealtimeChannel[] = [];

        tables.forEach((table) => {
            const channel = client
                .channel(`${table}_${salonId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: table,
                        filter: `salon_id=eq.${salonId}`,
                    },
                    () => onDataChange()
                )
                .subscribe();

            channels.push(channel);
        });

        return () => {
            channels.forEach((channel) => client.removeChannel(channel));
        };
    }, [tables.join(','), session?.salon?.id, enabled, onDataChange]);
}
