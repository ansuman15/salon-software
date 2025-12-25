"use client";

import styles from "./LogoutModal.module.css";

interface LogoutModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function LogoutModal({ isOpen, onConfirm, onCancel }: LogoutModalProps) {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.icon}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </div>
                <h2>Confirm Logout</h2>
                <p>Are you sure you want to logout? You'll need to sign in again to access your dashboard.</p>
                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onCancel}>
                        No, Stay
                    </button>
                    <button className={styles.confirmBtn} onClick={onConfirm}>
                        Yes, Logout
                    </button>
                </div>
            </div>
        </div>
    );
}
