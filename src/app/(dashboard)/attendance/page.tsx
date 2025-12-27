"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | '';

interface Staff {
    id: string;
    name: string;
    role: string;
    imageUrl?: string;
    isActive: boolean;
}

interface AttendanceRecord {
    staff_id: string;
    status: AttendanceStatus;
    check_in_time: string;
    check_out_time: string;
    notes: string;
    is_locked?: boolean;
}

interface SavedAttendance {
    id: string;
    staff_id: string;
    attendance_date: string;
    status: AttendanceStatus;
    check_in_time: string | null;
    check_out_time: string | null;
    notes: string | null;
    is_locked: boolean;
}

export default function AttendancePage() {
    const router = useRouter();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [isDateLocked, setIsDateLocked] = useState(false);
    const [lockThreshold, setLockThreshold] = useState(30);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showPastDateConfirm, setShowPastDateConfirm] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);
    const saveAttemptRef = useRef(0);

    const getDateStr = (date: Date) => date.toISOString().split('T')[0];
    const todayStr = getDateStr(new Date());

    // Load staff from API
    const loadStaff = useCallback(async () => {
        try {
            const res = await fetch('/api/staff');
            if (res.ok) {
                const data = await res.json();
                const activeStaff = (data.staff || []).filter((s: Staff) => s.isActive !== false);
                setStaff(activeStaff);
            }
        } catch (err) {
            console.error('Failed to load staff:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStaff();
    }, [loadStaff]);

    // Realtime sync - auto-refresh staff when changes occur
    useRealtimeSync({ table: 'staff', onDataChange: loadStaff });

    // Load attendance when date changes
    useEffect(() => {
        loadAttendance();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [selectedDate]);

    const loadAttendance = async () => {
        setError(null);
        setIsFetching(true);
        const dateStr = getDateStr(selectedDate);

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(`/api/attendance?date=${dateStr}`, {
                signal: abortControllerRef.current.signal,
            });

            if (response.ok) {
                const result = await response.json();
                setIsDateLocked(result.isLocked || false);
                setLockThreshold(result.lockThreshold || 30);

                // Initialize attendance state from saved data
                const attendanceMap: Record<string, AttendanceRecord> = {};
                for (const record of result.data || []) {
                    attendanceMap[record.staff_id] = {
                        staff_id: record.staff_id,
                        status: record.status,
                        check_in_time: record.check_in_time || '',
                        check_out_time: record.check_out_time || '',
                        notes: record.notes || '',
                        is_locked: record.is_locked,
                    };
                }
                setAttendance(attendanceMap);
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            console.error('Error loading attendance:', err);
            setAttendance({});
        } finally {
            setIsFetching(false);
        }
    };

    const navigateDate = (direction: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + direction);

        // Block future dates
        if (newDate > new Date()) {
            return;
        }

        setSelectedDate(newDate);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);

        // Block future dates
        if (newDate > new Date()) {
            return;
        }

        setSelectedDate(newDate);
    };

    const updateAttendance = (staffId: string, field: keyof AttendanceRecord, value: string) => {
        // Don't allow updates if date is locked
        if (isDateLocked) return;

        setAttendance(prev => ({
            ...prev,
            [staffId]: {
                ...prev[staffId],
                staff_id: staffId,
                [field]: value,
            }
        }));
        setSuccessMessage(null);
    };

    const handleSave = async (confirmed = false) => {
        const dateStr = getDateStr(selectedDate);

        // Prevent save if locked
        if (isDateLocked) {
            setError('This date is locked and cannot be edited');
            return;
        }

        // If past date and not confirmed, show confirmation
        if (dateStr < todayStr && !confirmed && !showPastDateConfirm) {
            setShowPastDateConfirm(true);
            setPendingSave(true);
            return;
        }

        setShowPastDateConfirm(false);
        setPendingSave(false);

        // Prevent double submit
        const currentAttempt = ++saveAttemptRef.current;
        if (isSaving) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Prepare records - only include staff with a status set
            const records = Object.values(attendance)
                .filter(a => a.status)
                .map(a => ({
                    staff_id: a.staff_id,
                    attendance_date: dateStr,
                    status: a.status,
                    check_in_time: a.check_in_time || null,
                    check_out_time: a.check_out_time || null,
                    notes: a.notes || null,
                }));

            if (records.length === 0) {
                setError('Please mark attendance for at least one staff member');
                setIsSaving(false);
                return;
            }

            // Check if this is still the current save attempt
            if (currentAttempt !== saveAttemptRef.current) return;

            const response = await fetch('/api/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    records,
                    confirmPastEdit: dateStr < todayStr,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.requireConfirmation) {
                    setShowPastDateConfirm(true);
                    setPendingSave(true);
                } else {
                    throw new Error(result.error || 'Failed to save attendance');
                }
                return;
            }

            setSuccessMessage(result.message);
        } catch (err: unknown) {
            console.error('Error saving attendance:', err);
            setError(err instanceof Error ? err.message : 'Failed to save attendance. Please try again.');
        } finally {
            if (currentAttempt === saveAttemptRef.current) {
                setIsSaving(false);
            }
        }
    };

    const markAllAs = (status: AttendanceStatus) => {
        if (isDateLocked) return;

        const newAttendance: Record<string, AttendanceRecord> = {};
        for (const s of staff) {
            newAttendance[s.id] = {
                staff_id: s.id,
                status,
                check_in_time: attendance[s.id]?.check_in_time || '',
                check_out_time: attendance[s.id]?.check_out_time || '',
                notes: attendance[s.id]?.notes || '',
            };
        }
        setAttendance(newAttendance);
        setSuccessMessage(null);
    };

    // Calculate summary
    const summary = {
        present: Object.values(attendance).filter(a => a.status === 'present').length,
        absent: Object.values(attendance).filter(a => a.status === 'absent').length,
        half_day: Object.values(attendance).filter(a => a.status === 'half_day').length,
        leave: Object.values(attendance).filter(a => a.status === 'leave').length,
        total: staff.length,
        marked: Object.values(attendance).filter(a => a.status).length,
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const isToday = getDateStr(selectedDate) === todayStr;
    const isPast = getDateStr(selectedDate) < todayStr;
    const isFuture = getDateStr(selectedDate) > todayStr;

    if (isLoading) {
        return <div className={styles.loading}><div className={styles.spinner}></div></div>;
    }

    return (
        <>
            <Header title="Attendance" subtitle="Track daily staff attendance" />

            <div className={styles.container}>
                {/* Date Navigation */}
                <div className={styles.dateNav}>
                    <button
                        className={styles.navBtn}
                        onClick={() => navigateDate(-1)}
                        disabled={isSaving}
                    >
                        ← Previous
                    </button>

                    <div className={styles.dateDisplay}>
                        <input
                            type="date"
                            className={styles.datePicker}
                            value={getDateStr(selectedDate)}
                            max={todayStr}
                            onChange={handleDateChange}
                            disabled={isSaving}
                        />
                        <span className={styles.dateLabel}>
                            {formatDate(selectedDate)}
                            {isToday && <span className={styles.todayBadge}>Today</span>}
                            {isPast && !isDateLocked && <span className={styles.pastBadge}>Past</span>}
                            {isDateLocked && <span className={styles.lockedBadge}>🔒 Locked</span>}
                        </span>
                    </div>

                    <button
                        className={styles.navBtn}
                        onClick={() => navigateDate(1)}
                        disabled={isFuture || isToday || isSaving}
                    >
                        Next →
                    </button>
                </div>

                {/* Lock Warning */}
                {isDateLocked && (
                    <div className={styles.lockWarning}>
                        🔒 This date is older than {lockThreshold} days and is locked for editing.
                        Contact admin to make changes.
                    </div>
                )}

                {/* Quick Actions */}
                {!isDateLocked && (
                    <div className={styles.quickActions}>
                        <span>Quick Mark:</span>
                        <button onClick={() => markAllAs('present')} disabled={isSaving}>All Present</button>
                        <button onClick={() => markAllAs('absent')} disabled={isSaving}>All Absent</button>
                    </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                    <div className={styles.errorBanner}>
                        ⚠️ {error}
                        <button onClick={() => setError(null)}>✕</button>
                    </div>
                )}
                {successMessage && (
                    <div className={styles.successBanner}>
                        ✓ {successMessage}
                        <button onClick={() => setSuccessMessage(null)}>✕</button>
                    </div>
                )}

                {/* Staff Attendance Table */}
                {staff.length === 0 ? (
                    <div className={styles.empty}>
                        <p>No active staff members</p>
                        <button onClick={() => router.push('/staff')}>Add Staff</button>
                    </div>
                ) : isFetching ? (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Staff</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map(member => (
                                    <tr key={member.id} className={styles.skeletonRow}>
                                        <td><div className={styles.skeleton}></div></td>
                                        <td><div className={styles.skeleton}></div></td>
                                        <td><div className={styles.skeleton}></div></td>
                                        <td><div className={styles.skeleton}></div></td>
                                        <td><div className={styles.skeleton}></div></td>
                                        <td><div className={styles.skeleton}></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Staff</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Check-in</th>
                                    <th>Check-out</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map(member => {
                                    const record = attendance[member.id] || {};
                                    const isRecordLocked = record.is_locked || isDateLocked;
                                    return (
                                        <tr key={member.id} className={isRecordLocked ? styles.lockedRow : ''}>
                                            <td>
                                                <div className={styles.staffCell}>
                                                    {member.imageUrl ? (
                                                        <img
                                                            src={member.imageUrl}
                                                            alt={member.name}
                                                            className={styles.staffAvatar}
                                                        />
                                                    ) : (
                                                        <div className={styles.staffInitials}>
                                                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                        </div>
                                                    )}
                                                    <span>{member.name}</span>
                                                </div>
                                            </td>
                                            <td className={styles.roleCell}>{member.role}</td>
                                            <td>
                                                <select
                                                    className={`${styles.statusSelect} ${record.status ? styles[record.status] : ''}`}
                                                    value={record.status || ''}
                                                    onChange={e => updateAttendance(member.id, 'status', e.target.value)}
                                                    disabled={isRecordLocked || isSaving}
                                                >
                                                    <option value="">Select</option>
                                                    <option value="present">Present</option>
                                                    <option value="absent">Absent</option>
                                                    <option value="half_day">Half-Day</option>
                                                    <option value="leave">Leave</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="time"
                                                    className={styles.timeInput}
                                                    value={record.check_in_time || ''}
                                                    onChange={e => updateAttendance(member.id, 'check_in_time', e.target.value)}
                                                    disabled={isRecordLocked || isSaving || (record.status !== 'present' && record.status !== 'half_day')}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="time"
                                                    className={styles.timeInput}
                                                    value={record.check_out_time || ''}
                                                    onChange={e => updateAttendance(member.id, 'check_out_time', e.target.value)}
                                                    disabled={isRecordLocked || isSaving || (record.status !== 'present' && record.status !== 'half_day')}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    className={styles.notesInput}
                                                    placeholder="Add note..."
                                                    value={record.notes || ''}
                                                    onChange={e => updateAttendance(member.id, 'notes', e.target.value)}
                                                    disabled={isRecordLocked || isSaving}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Summary Bar */}
                <div className={styles.summary}>
                    <div className={styles.summaryItem}>
                        <span className={`${styles.summaryDot} ${styles.present}`}></span>
                        <span>Present: {summary.present}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={`${styles.summaryDot} ${styles.absent}`}></span>
                        <span>Absent: {summary.absent}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={`${styles.summaryDot} ${styles.half_day}`}></span>
                        <span>Half-Day: {summary.half_day}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span className={`${styles.summaryDot} ${styles.leave}`}></span>
                        <span>Leave: {summary.leave}</span>
                    </div>
                    <div className={styles.summaryDivider}></div>
                    <div className={styles.summaryItem}>
                        <span>Marked: {summary.marked}/{summary.total}</span>
                    </div>
                </div>

                {/* Save Button */}
                <div className={styles.saveSection}>
                    <button
                        className={styles.saveBtn}
                        onClick={() => handleSave()}
                        disabled={isSaving || isDateLocked || staff.length === 0 || isFetching}
                    >
                        {isSaving ? (
                            <>
                                <span className={styles.savingSpinner}></span>
                                Saving...
                            </>
                        ) : isDateLocked ? (
                            '🔒 Locked'
                        ) : (
                            'Save Attendance'
                        )}
                    </button>
                </div>

                {/* Past Date Confirmation Modal */}
                {showPastDateConfirm && (
                    <div className={styles.modalOverlay} onClick={() => { setShowPastDateConfirm(false); setPendingSave(false); }}>
                        <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                            <h3>Edit Past Attendance?</h3>
                            <p>You are editing attendance for <strong>{formatDate(selectedDate)}</strong>.</p>
                            <p className={styles.warning}>This will update existing records for this date.</p>
                            <div className={styles.modalActions}>
                                <button onClick={() => { setShowPastDateConfirm(false); setPendingSave(false); }}>Cancel</button>
                                <button className={styles.confirmBtn} onClick={() => handleSave(true)}>
                                    Yes, Update
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
