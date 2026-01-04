"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface SessionSalon {
    id: string;
    name: string;
    email: string;
    phone?: string;
    city?: string;
    logo_url?: string;
    gst_percentage?: number;
    gst_number?: string;
}

export interface SessionData {
    authenticated: boolean;
    isAdmin?: boolean;
    salon: SessionSalon | null;
}

interface SessionContextType {
    session: SessionData | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [session, setSession] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSession = async () => {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();

            if (res.ok && data.authenticated) {
                setSession({
                    authenticated: true,
                    isAdmin: data.isAdmin || false,
                    salon: data.salon || null,
                });
                setError(null);
            } else {
                setSession({ authenticated: false, salon: null });
                setError(data.reason || 'Not authenticated');
            }
        } catch (e) {
            console.error('[SessionProvider] Error:', e);
            setSession({ authenticated: false, salon: null });
            setError('Session check failed');
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setSession({ authenticated: false, salon: null });
            router.replace('/login');
        } catch (e) {
            console.error('[SessionProvider] Logout error:', e);
        }
    };

    useEffect(() => {
        fetchSession();
    }, []);

    return (
        <SessionContext.Provider value={{ session, loading, error, refresh: fetchSession, logout }}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
