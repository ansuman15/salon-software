"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import styles from "./page.module.css";

type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | '';

interface Staff {
    id: string;
    name: string;
    role: string;
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

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
    { value: 'present', label: 'Present' },
    { value: 'absent', label: 'Absent' },
    { value: 'half_day', label: 'Half Day' },
    { value: 'leave', label: 'Leave' },
];

export default function AttendancePage() {
    const router = useRouter();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [initialAttendance, setInitialAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [isDateLocked, setIsDateLocked] = useState(false);
    const [lockThreshold, setLockThreshold] = useState(30);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showPastDateConfirm, setShowPastDateConfirm] = useState(false);

    // Export state
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportType, setExportType] = useState<'date' | 'range' | 'month'>('month');
    const [exportFrom, setExportFrom] = useState('');
    const [exportTo, setExportTo] = useState('');
    const [exportMonth, setExportMonth] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);
    const saveAttemptRef = useRef(0);

    const getDateStr = (date: Date) => date.toISOString().split('T')[0];
    const todayStr = getDateStr(new Date());

    // Check for unsaved changes
    const hasUnsavedChanges = JSON.stringify(attendance) !== JSON.stringify(initialAttendance);

    // Warn before navigating away with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

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

    // Realtime sync
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
                setInitialAttendance(attendanceMap);
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return;
            console.error('Error loading attendance:', err);
            setAttendance({});
            setInitialAttendance({});
        } finally {
            setIsFetching(false);
        }
    };

    const navigateDate = (direction: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + direction);
        if (newDate > new Date()) return;
        setSelectedDate(newDate);
    };

    const goToToday = () => {
        setSelectedDate(new Date());
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        if (newDate > new Date()) return;
        setSelectedDate(newDate);
    };

    const updateStatus = (staffId: string, status: AttendanceStatus) => {
        if (isDateLocked) return;

        setAttendance(prev => ({
            ...prev,
            [staffId]: {
                ...prev[staffId],
                staff_id: staffId,
                status: prev[staffId]?.status === status ? '' : status, // Toggle off if same
                check_in_time: prev[staffId]?.check_in_time || '',
                check_out_time: prev[staffId]?.check_out_time || '',
                notes: prev[staffId]?.notes || '',
            }
        }));
        setSuccessMessage(null);
    };

    const updateField = (staffId: string, field: keyof AttendanceRecord, value: string) => {
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

        if (isDateLocked) {
            setError('This date is locked and cannot be edited');
            return;
        }

        // If past date and not confirmed
        if (dateStr < todayStr && !confirmed && !showPastDateConfirm) {
            setShowPastDateConfirm(true);
            return;
        }

        setShowPastDateConfirm(false);

        // Prevent double submit
        const currentAttempt = ++saveAttemptRef.current;
        if (isSaving) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
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
                } else {
                    throw new Error(result.error || 'Failed to save attendance');
                }
                return;
            }

            setSuccessMessage(result.message);
            setInitialAttendance(attendance); // Reset unsaved changes tracking
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
        halfDay: Object.values(attendance).filter(a => a.status === 'half_day').length,
        leave: Object.values(attendance).filter(a => a.status === 'leave').length,
        total: staff.length,
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const isToday = getDateStr(selectedDate) === todayStr;
    const isPast = getDateStr(selectedDate) < todayStr;

    const getPillClass = (currentStatus: AttendanceStatus, pillStatus: AttendanceStatus) => {
        if (currentStatus !== pillStatus) return styles.pill;
        switch (pillStatus) {
            case 'present': return `${styles.pill} ${styles.pillPresent}`;
            case 'absent': return `${styles.pill} ${styles.pillAbsent}`;
            case 'half_day': return `${styles.pill} ${styles.pillHalfDay}`;
            case 'leave': return `${styles.pill} ${styles.pillLeave}`;
            default: return styles.pill;
        }
    };

    // Export handler - supports both Excel and PDF
    const handleExport = async (format: 'excel' | 'pdf' = 'excel') => {
        setIsExporting(true);
        try {
            const basePath = format === 'pdf' ? '/api/attendance/export/pdf?' : '/api/attendance/export?';
            let url = basePath;

            if (exportType === 'date') {
                url += `date=${getDateStr(selectedDate)}`;
            } else if (exportType === 'range' && exportFrom && exportTo) {
                url += `from=${exportFrom}&to=${exportTo}`;
            } else if (exportType === 'month' && exportMonth) {
                url += `month=${exportMonth}`;
            } else {
                // Default to current month
                const now = new Date();
                url += `month=${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = format === 'pdf' ? `Attendance_Export.pdf` : `Attendance_Export.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            setShowExportModal(false);
            setSuccessMessage(`${format.toUpperCase()} export downloaded successfully!`);
        } catch (err) {
            console.error('Export error:', err);
            setError('Failed to export attendance');
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Sticky Header */}
            <header className={styles.stickyHeader}>
                <h1 className={styles.headerTitle}>Attendance</h1>

                <div className={styles.dateNav}>
                    <button
                        className={styles.navBtn}
                        onClick={() => navigateDate(-1)}
                        disabled={isSaving}
                    >
                        ← Prev
                    </button>

                    <button
                        className={`${styles.navBtn} ${styles.todayBtn}`}
                        onClick={goToToday}
                        disabled={isToday || isSaving}
                    >
                        Today
                    </button>

                    <button
                        className={styles.navBtn}
                        onClick={() => navigateDate(1)}
                        disabled={isToday || isSaving}
                    >
                        Next →
                    </button>

                    <button
                        className={styles.navBtn}
                        onClick={() => {
                            setExportMonth(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`);
                            setShowExportModal(true);
                        }}
                        disabled={isSaving}
                    >
                        📥 Export
                    </button>
                </div>

                <div className={styles.dateLabel}>
                    <input
                        type="date"
                        className={styles.datePicker}
                        value={getDateStr(selectedDate)}
                        max={todayStr}
                        onChange={handleDateChange}
                        disabled={isSaving}
                    />
                    <span>{formatDate(selectedDate)}</span>
                    {isToday && <span className={styles.todayBadge}>Today</span>}
                    {isPast && !isDateLocked && <span className={styles.pastBadge}>Past</span>}
                    {isDateLocked && <span className={styles.lockedBadge}>🔒 Locked</span>}
                </div>
            </header>

            {/* Lock Warning */}
            {isDateLocked && (
                <div className={styles.lockWarning}>
                    🔒 This date is older than {lockThreshold} days and is locked. Contact admin to make changes.
                </div>
            )}

            {/* Quick Actions */}
            {!isDateLocked && staff.length > 0 && (
                <div className={styles.quickActions}>
                    <span>Quick mark:</span>
                    <button
                        className={styles.quickActionBtn}
                        onClick={() => markAllAs('present')}
                        disabled={isSaving}
                    >
                        All Present
                    </button>
                    <button
                        className={styles.quickActionBtn}
                        onClick={() => markAllAs('absent')}
                        disabled={isSaving}
                    >
                        All Absent
                    </button>
                </div>
            )}

            {/* Messages */}
            {error && (
                <div className={styles.errorMessage}>
                    ⚠️ {error}
                    <button className={styles.messageClose} onClick={() => setError(null)}>✕</button>
                </div>
            )}
            {successMessage && (
                <div className={styles.successMessage}>
                    ✓ {successMessage}
                    <button className={styles.messageClose} onClick={() => setSuccessMessage(null)}>✕</button>
                </div>
            )}

            {/* Main Grid Container */}
            <div className={styles.gridContainer}>
                {staff.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No active staff members</p>
                        <button onClick={() => router.push('/staff')}>Add Staff</button>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Staff</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>In</th>
                                    <th>Out</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isFetching ? (
                                    staff.map(member => (
                                        <tr key={member.id} className={styles.skeletonRow}>
                                            <td><div className={styles.skeleton} style={{ width: '120px' }}></div></td>
                                            <td><div className={styles.skeleton} style={{ width: '80px' }}></div></td>
                                            <td><div className={styles.skeleton} style={{ width: '200px' }}></div></td>
                                            <td><div className={styles.skeleton} style={{ width: '70px' }}></div></td>
                                            <td><div className={styles.skeleton} style={{ width: '70px' }}></div></td>
                                            <td><div className={styles.skeleton} style={{ width: '100px' }}></div></td>
                                        </tr>
                                    ))
                                ) : (
                                    staff.map(member => {
                                        const record = attendance[member.id] || { status: '' as AttendanceStatus };
                                        const isRecordLocked = record.is_locked || isDateLocked;
                                        const showTimeInputs = record.status === 'present' || record.status === 'half_day';

                                        return (
                                            <tr key={member.id}>
                                                <td>
                                                    <span className={styles.staffName}>{member.name}</span>
                                                </td>
                                                <td>
                                                    <span className={styles.staffRole}>{member.role}</span>
                                                </td>
                                                <td>
                                                    <div className={styles.statusPills}>
                                                        {STATUS_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                className={getPillClass(record.status, opt.value)}
                                                                onClick={() => updateStatus(member.id, opt.value)}
                                                                disabled={isRecordLocked || isSaving}
                                                                type="button"
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="time"
                                                        className={styles.timeInput}
                                                        value={record.check_in_time || ''}
                                                        onChange={e => updateField(member.id, 'check_in_time', e.target.value)}
                                                        disabled={isRecordLocked || isSaving || !showTimeInputs}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="time"
                                                        className={styles.timeInput}
                                                        value={record.check_out_time || ''}
                                                        onChange={e => updateField(member.id, 'check_out_time', e.target.value)}
                                                        disabled={isRecordLocked || isSaving || !showTimeInputs}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        className={styles.notesInput}
                                                        placeholder="Add note..."
                                                        value={record.notes || ''}
                                                        onChange={e => updateField(member.id, 'notes', e.target.value)}
                                                        disabled={isRecordLocked || isSaving}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Sticky Footer */}
            <footer className={styles.stickyFooter}>
                <div className={styles.summaryStats}>
                    <div className={styles.statItem}>
                        <span className={`${styles.statDot} ${styles.present}`}></span>
                        <span>Present: <span className={styles.statValue}>{summary.present}</span></span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={`${styles.statDot} ${styles.absent}`}></span>
                        <span>Absent: <span className={styles.statValue}>{summary.absent}</span></span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={`${styles.statDot} ${styles.halfDay}`}></span>
                        <span>Half Day: <span className={styles.statValue}>{summary.halfDay}</span></span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={`${styles.statDot} ${styles.leave}`}></span>
                        <span>Leave: <span className={styles.statValue}>{summary.leave}</span></span>
                    </div>
                </div>

                <button
                    className={styles.saveBtn}
                    onClick={() => handleSave()}
                    disabled={isSaving || isDateLocked || staff.length === 0 || isFetching}
                >
                    {isSaving ? (
                        <>
                            <span className={styles.spinner}></span>
                            Saving...
                        </>
                    ) : isDateLocked ? (
                        '🔒 Locked'
                    ) : (
                        'Save Attendance'
                    )}
                </button>
            </footer>

            {/* Past Date Confirmation Modal */}
            {showPastDateConfirm && (
                <div className={styles.modalOverlay} onClick={() => setShowPastDateConfirm(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Edit Past Attendance?</h3>
                        <p>You are editing attendance for <strong>{formatDate(selectedDate)}</strong>.</p>
                        <p className={styles.modalWarning}>This will update existing records for this date.</p>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setShowPastDateConfirm(false)}>
                                Cancel
                            </button>
                            <button className={styles.confirmBtn} onClick={() => handleSave(true)}>
                                Yes, Update
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {showExportModal && (
                <div className={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>📥 Export Attendance</h3>

                        <div className={styles.exportTypeSelector}>
                            <button
                                className={`${styles.exportTypeBtn} ${exportType === 'date' ? styles.active : ''}`}
                                onClick={() => setExportType('date')}
                            >
                                Single Date
                            </button>
                            <button
                                className={`${styles.exportTypeBtn} ${exportType === 'range' ? styles.active : ''}`}
                                onClick={() => setExportType('range')}
                            >
                                Date Range
                            </button>
                            <button
                                className={`${styles.exportTypeBtn} ${exportType === 'month' ? styles.active : ''}`}
                                onClick={() => setExportType('month')}
                            >
                                Month
                            </button>
                        </div>

                        <div className={styles.exportInputs}>
                            {exportType === 'date' && (
                                <p className={styles.exportInfo}>
                                    Exporting: <strong>{formatDate(selectedDate)}</strong>
                                </p>
                            )}

                            {exportType === 'range' && (
                                <div className={styles.dateRangeInputs}>
                                    <label>
                                        From:
                                        <input
                                            type="date"
                                            value={exportFrom}
                                            onChange={(e) => setExportFrom(e.target.value)}
                                        />
                                    </label>
                                    <label>
                                        To:
                                        <input
                                            type="date"
                                            value={exportTo}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setExportTo(e.target.value)}
                                        />
                                    </label>
                                </div>
                            )}

                            {exportType === 'month' && (
                                <label className={styles.monthInput}>
                                    Month:
                                    <input
                                        type="month"
                                        value={exportMonth}
                                        onChange={(e) => setExportMonth(e.target.value)}
                                    />
                                </label>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowExportModal(false)}
                                disabled={isExporting}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.confirmBtn}
                                onClick={() => handleExport('pdf')}
                                disabled={isExporting || (exportType === 'range' && (!exportFrom || !exportTo))}
                            >
                                {isExporting ? 'Exporting...' : '📄 Download PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
