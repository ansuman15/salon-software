"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log error to console (visible in Vercel logs)
        console.error('Application error:', error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <h2 style={{ marginBottom: '16px' }}>Something went wrong!</h2>
                    <p style={{ color: '#666', marginBottom: '24px' }}>
                        Please try again or contact support if the problem persists.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            padding: '12px 24px',
                            background: '#000',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
