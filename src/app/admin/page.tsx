"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_EMAILS } from "@/lib/config";
import { db } from "@/lib/database";
import styles from "./page.module.css";

interface Salon {
    id: string;
    name: string;
    owner_email: string;
    phone?: string;
    city?: string;
    status: 'inactive' | 'active' | 'suspended';
    last_login_at: string | null;
    created_at: string;
}

interface Lead {
    id: string;
    salon_name: string;
    owner_name: string;
    email: string;
    phone: string;
    city?: string;
    staff_size?: string;
    requirements?: string;
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'rejected';
    notes?: string;
    created_at: string;
}

type Tab = 'salons' | 'leads';

export default function AdminPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('salons');

    // Salons state
    const [salons, setSalons] = useState<Salon[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSalon, setNewSalon] = useState({ name: '', ownerEmail: '', phone: '', city: '' });
    const [createdKey, setCreatedKey] = useState<{ key: string; expires: string } | null>(null);

    // Leads state
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // General state
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        console.log('[Admin Page] Checking admin access...');

        // Always check API session first (cookie-based, server-side)
        try {
            const res = await fetch('/api/auth/session');
            if (res.ok) {
                const data = await res.json();
                console.log('[Admin Page] Session API response:', data);

                // Check for admin access - either from salon email or direct admin session
                const sessionEmail = data.email || data.salon?.email;
                const isAdminSession = data.isAdmin === true;

                if (data.authenticated && (isAdminSession || ADMIN_EMAILS.includes(sessionEmail))) {
                    console.log('[Admin Page] Admin access granted via API session');
                    setIsAdmin(true);
                    await Promise.all([loadSalons(), loadLeads()]);
                    setIsLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.error('[Admin Page] Session API error:', e);
        }

        // Fallback: check localStorage session (for backward compatibility)
        const localSession = db.auth.getSession();
        console.log('[Admin Page] Local session:', localSession);

        if (localSession && ADMIN_EMAILS.includes(localSession.email)) {
            console.log('[Admin Page] Admin access granted via localStorage');
            setIsAdmin(true);
            await Promise.all([loadSalons(), loadLeads()]);
            setIsLoading(false);
            return;
        }

        // If we got here but there's an old local session, clear it
        if (localSession) {
            console.log('[Admin Page] Clearing stale local session');
            db.auth.logout();
        }

        // Redirect to login
        console.log('[Admin Page] No valid admin session, redirecting to login');
        router.replace('/admin/login');
        setIsLoading(false);
    };

    const loadSalons = async () => {
        try {
            const res = await fetch('/api/admin/salons');
            if (res.ok) {
                const data = await res.json();
                setSalons(data.salons || []);
            }
        } catch (e) {
            console.error('Failed to load salons:', e);
        }
    };

    const loadLeads = async () => {
        try {
            const res = await fetch('/api/admin/leads');
            if (res.ok) {
                const data = await res.json();
                setLeads(data.leads || []);
            }
        } catch (e) {
            console.error('Failed to load leads:', e);
        }
    };

    const handleCreateSalon = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setActionLoading('create');

        try {
            const res = await fetch('/api/admin/salons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSalon),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setCreatedKey({
                    key: data.activationKey,
                    expires: new Date(data.expiresAt).toLocaleString(),
                });
                setNewSalon({ name: '', ownerEmail: '', phone: '', city: '' });
                await loadSalons();
            } else {
                setError(data.error || 'Failed to create salon');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSalonAction = async (salonId: string, action: 'suspend' | 'reactivate' | 'regenerate-key') => {
        setActionLoading(salonId);
        try {
            const res = await fetch(`/api/admin/salons/${salonId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (action === 'regenerate-key' && data.activationKey) {
                    setCreatedKey({
                        key: data.activationKey,
                        expires: new Date(data.expiresAt).toLocaleString(),
                    });
                    setShowCreateModal(true);
                }
                await loadSalons();
            } else {
                alert(data.error || 'Action failed');
            }
        } catch {
            alert('Network error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleLeadStatusUpdate = async (leadId: string, status: Lead['status'], notes?: string) => {
        setActionLoading(leadId);
        try {
            const res = await fetch('/api/admin/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: leadId, status, notes }),
            });

            if (res.ok) {
                await loadLeads();
                setSelectedLead(null);
            }
        } catch {
            alert('Failed to update lead');
        } finally {
            setActionLoading(null);
        }
    };

    const handleConvertLead = async (lead: Lead) => {
        setNewSalon({
            name: lead.salon_name,
            ownerEmail: lead.email,
            phone: lead.phone,
            city: lead.city || '',
        });
        setShowCreateModal(true);
        // Mark lead as converted after salon is created
    };

    const copyKey = () => {
        if (createdKey) {
            navigator.clipboard.writeText(createdKey.key);
            alert('Activation key copied to clipboard!');
        }
    };

    const getStatusColor = (status: Lead['status']) => {
        const colors: Record<Lead['status'], string> = {
            new: '#3b82f6',
            contacted: '#f59e0b',
            qualified: '#10b981',
            converted: '#22c55e',
            rejected: '#ef4444',
        };
        return colors[status];
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                </div>
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <h1>SalonX Admin Panel</h1>
                    <p>Manage salons, leads, and activation keys</p>
                </div>
                <button className={styles.createBtn} onClick={() => setShowCreateModal(true)}>
                    + Create Salon
                </button>
            </header>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'salons' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('salons')}
                >
                    Salons ({salons.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'leads' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('leads')}
                >
                    Leads ({leads.length})
                </button>
            </div>

            <main className={styles.main}>
                {/* Salons Tab */}
                {activeTab === 'salons' && (
                    <section className={styles.section}>
                        {salons.length === 0 ? (
                            <div className={styles.empty}>
                                <p>No salons created yet.</p>
                                <button onClick={() => setShowCreateModal(true)}>
                                    Create your first salon
                                </button>
                            </div>
                        ) : (
                            <div className={styles.salonGrid}>
                                {salons.map(salon => (
                                    <div key={salon.id} className={styles.salonCard}>
                                        <div className={styles.salonHeader}>
                                            <h3>{salon.name}</h3>
                                            <span className={`${styles.status} ${styles[salon.status]}`}>
                                                {salon.status}
                                            </span>
                                        </div>
                                        <p className={styles.email}>{salon.owner_email}</p>
                                        <div className={styles.salonMeta}>
                                            <span>Created: {new Date(salon.created_at).toLocaleDateString()}</span>
                                            {salon.last_login_at && (
                                                <span>Last login: {new Date(salon.last_login_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                        <div className={styles.salonActions}>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => handleSalonAction(salon.id, 'regenerate-key')}
                                                disabled={actionLoading === salon.id}
                                            >
                                                {actionLoading === salon.id ? '...' : 'Regenerate Key'}
                                            </button>
                                            <button
                                                className={styles.actionBtn}
                                                onClick={() => handleSalonAction(
                                                    salon.id,
                                                    salon.status === 'suspended' ? 'reactivate' : 'suspend'
                                                )}
                                                disabled={actionLoading === salon.id}
                                            >
                                                {salon.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* Leads Tab */}
                {activeTab === 'leads' && (
                    <section className={styles.section}>
                        {leads.length === 0 ? (
                            <div className={styles.empty}>
                                <p>No leads yet. They will appear here when users request access from the landing page.</p>
                            </div>
                        ) : (
                            <div className={styles.leadsTable}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Salon</th>
                                            <th>Owner</th>
                                            <th>Contact</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leads.map(lead => (
                                            <tr key={lead.id}>
                                                <td>
                                                    <strong>{lead.salon_name}</strong>
                                                    <br />
                                                    <small>{lead.city}</small>
                                                </td>
                                                <td>{lead.owner_name}</td>
                                                <td>
                                                    {lead.email}
                                                    <br />
                                                    <small>{lead.phone}</small>
                                                </td>
                                                <td>
                                                    <select
                                                        value={lead.status}
                                                        onChange={(e) => handleLeadStatusUpdate(lead.id, e.target.value as Lead['status'])}
                                                        style={{ borderColor: getStatusColor(lead.status) }}
                                                        disabled={actionLoading === lead.id}
                                                    >
                                                        <option value="new">New</option>
                                                        <option value="contacted">Contacted</option>
                                                        <option value="qualified">Qualified</option>
                                                        <option value="converted">Converted</option>
                                                        <option value="rejected">Rejected</option>
                                                    </select>
                                                </td>
                                                <td>{new Date(lead.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    <button
                                                        className={styles.convertBtn}
                                                        onClick={() => handleConvertLead(lead)}
                                                        disabled={lead.status === 'converted' || lead.status === 'rejected'}
                                                    >
                                                        Convert to Salon
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* Create Salon Modal */}
            {showCreateModal && (
                <div className={styles.modalOverlay} onClick={() => !createdKey && setShowCreateModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        {createdKey ? (
                            <>
                                <h2>✅ Activation Key Generated!</h2>
                                <div className={styles.keyDisplay}>
                                    <label>Share this key with the salon owner:</label>
                                    <div className={styles.keyBox}>
                                        <code>{createdKey.key}</code>
                                        <button onClick={copyKey}>Copy</button>
                                    </div>
                                    <p className={styles.keyExpiry}>
                                        Initial window: {createdKey.expires}
                                        <br />
                                        <small>After first login, key never expires</small>
                                    </p>
                                </div>
                                <p className={styles.warning}>
                                    ⚠️ This key will NOT be shown again. Copy it now!
                                </p>
                                <button
                                    className={styles.doneBtn}
                                    onClick={() => {
                                        setCreatedKey(null);
                                        setShowCreateModal(false);
                                    }}
                                >
                                    Done
                                </button>
                            </>
                        ) : (
                            <>
                                <h2>Create New Salon</h2>
                                <form onSubmit={handleCreateSalon}>
                                    {error && <div className={styles.error}>{error}</div>}

                                    <div className={styles.field}>
                                        <label>Salon Name *</label>
                                        <input
                                            type="text"
                                            value={newSalon.name}
                                            onChange={e => setNewSalon({ ...newSalon, name: e.target.value })}
                                            placeholder="Beautiful Salon"
                                            required
                                        />
                                    </div>

                                    <div className={styles.field}>
                                        <label>Owner Email *</label>
                                        <input
                                            type="email"
                                            value={newSalon.ownerEmail}
                                            onChange={e => setNewSalon({ ...newSalon, ownerEmail: e.target.value })}
                                            placeholder="owner@example.com"
                                            required
                                        />
                                    </div>

                                    <div className={styles.row}>
                                        <div className={styles.field}>
                                            <label>Phone</label>
                                            <input
                                                type="tel"
                                                value={newSalon.phone}
                                                onChange={e => setNewSalon({ ...newSalon, phone: e.target.value })}
                                                placeholder="+91 98765 43210"
                                            />
                                        </div>
                                        <div className={styles.field}>
                                            <label>City</label>
                                            <input
                                                type="text"
                                                value={newSalon.city}
                                                onChange={e => setNewSalon({ ...newSalon, city: e.target.value })}
                                                placeholder="Mumbai"
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.modalActions}>
                                        <button
                                            type="button"
                                            className={styles.cancelBtn}
                                            onClick={() => setShowCreateModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className={styles.submitBtn}
                                            disabled={actionLoading === 'create'}
                                        >
                                            {actionLoading === 'create' ? 'Creating...' : 'Create & Generate Key'}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
