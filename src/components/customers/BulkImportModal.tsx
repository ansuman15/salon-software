"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import styles from "./BulkImportModal.module.css";

interface BulkImportModalProps {
    onClose: () => void;
    onImport: (customers: CustomerData[]) => void;
}

export interface CustomerData {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
}

interface ParsedRow {
    [key: string]: string;
}

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const UploadIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17,8 12,3 7,8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const FileIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
    </svg>
);

const CheckIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
);

export default function BulkImportModal({ onClose, onImport }: BulkImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState({
        name: "",
        phone: "",
        email: "",
        notes: "",
    });
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseFile = useCallback((file: File) => {
        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: "binary" });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, { defval: "" });

                if (jsonData.length > 0) {
                    const cols = Object.keys(jsonData[0]);
                    setColumns(cols);
                    setParsedData(jsonData);

                    // Auto-detect column mapping
                    const newMapping = { name: "", phone: "", email: "", notes: "" };
                    cols.forEach(col => {
                        const lowerCol = col.toLowerCase();
                        if (lowerCol.includes("name") && !newMapping.name) {
                            newMapping.name = col;
                        } else if ((lowerCol.includes("phone") || lowerCol.includes("mobile") || lowerCol.includes("cell")) && !newMapping.phone) {
                            newMapping.phone = col;
                        } else if (lowerCol.includes("email") && !newMapping.email) {
                            newMapping.email = col;
                        } else if ((lowerCol.includes("note") || lowerCol.includes("comment") || lowerCol.includes("remark")) && !newMapping.notes) {
                            newMapping.notes = col;
                        }
                    });
                    setColumnMapping(newMapping);
                }
            } catch (error) {
                console.error("Error parsing file:", error);
                alert("Error parsing file. Please ensure it's a valid CSV or Excel file.");
            } finally {
                setIsLoading(false);
            }
        };

        reader.readAsBinaryString(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && isValidFile(droppedFile)) {
            setFile(droppedFile);
            parseFile(droppedFile);
        }
    }, [parseFile]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && isValidFile(selectedFile)) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const isValidFile = (file: File): boolean => {
        const validTypes = [
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ];
        const validExtensions = [".csv", ".xls", ".xlsx"];
        const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        return validTypes.includes(file.type) || hasValidExtension;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    };

    const handleImport = () => {
        if (!columnMapping.name || !columnMapping.phone) {
            alert("Please map at least the Name and Phone columns.");
            return;
        }

        setIsLoading(true);
        const customers: CustomerData[] = [];
        let failed = 0;

        parsedData.forEach(row => {
            const name = String(row[columnMapping.name] || "").trim();
            const phone = String(row[columnMapping.phone] || "").trim();

            if (name && phone) {
                customers.push({
                    name,
                    phone,
                    email: columnMapping.email ? String(row[columnMapping.email] || "").trim() || undefined : undefined,
                    notes: columnMapping.notes ? String(row[columnMapping.notes] || "").trim() || undefined : undefined,
                });
            } else {
                failed++;
            }
        });

        setTimeout(() => {
            onImport(customers);
            setImportResult({ success: customers.length, failed });
            setIsLoading(false);
        }, 500);
    };

    const resetFile = () => {
        setFile(null);
        setParsedData([]);
        setColumns([]);
        setColumnMapping({ name: "", phone: "", email: "", notes: "" });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Import Customers</h3>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <CloseIcon />
                    </button>
                </div>

                <div className={styles.content}>
                    {isLoading ? (
                        <div className={styles.loading}>
                            <div className={styles.spinner}></div>
                            <p>Processing file...</p>
                        </div>
                    ) : importResult ? (
                        <div className={`${styles.result} ${styles.success}`}>
                            <CheckIcon />
                            <h4>Import Complete!</h4>
                            <p>Your customers have been imported successfully.</p>
                            <div className={styles.resultStats}>
                                <div className={styles.resultStat}>
                                    <span>{importResult.success}</span>
                                    <span>Imported</span>
                                </div>
                                {importResult.failed > 0 && (
                                    <div className={styles.resultStat}>
                                        <span>{importResult.failed}</span>
                                        <span>Skipped</span>
                                    </div>
                                )}
                            </div>
                            <button className={styles.doneBtn} onClick={onClose}>Done</button>
                        </div>
                    ) : !file ? (
                        <div
                            className={`${styles.dropZone} ${isDragging ? styles.active : ""}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadIcon />
                            <h4>Drop your file here</h4>
                            <p>or click to browse</p>
                            <span className={styles.browseBtn}>Choose File</span>
                            <p className={styles.acceptedFormats}>Accepts CSV, XLS, XLSX</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xls,.xlsx"
                                onChange={handleFileSelect}
                                style={{ display: "none" }}
                            />
                        </div>
                    ) : (
                        <>
                            <div className={styles.fileInfo}>
                                <div className={styles.fileIcon}>
                                    <FileIcon />
                                </div>
                                <div className={styles.fileDetails}>
                                    <span className={styles.fileName}>{file.name}</span>
                                    <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
                                </div>
                                <button className={styles.removeFile} onClick={resetFile}>
                                    <CloseIcon />
                                </button>
                            </div>

                            {parsedData.length > 0 && (
                                <>
                                    <div className={styles.mappingSection}>
                                        <h4>Column Mapping</h4>
                                        <div className={styles.mappingGrid}>
                                            <div className={styles.mappingItem}>
                                                <label>Name *</label>
                                                <select
                                                    value={columnMapping.name}
                                                    onChange={e => setColumnMapping({ ...columnMapping, name: e.target.value })}
                                                >
                                                    <option value="">-- Select --</option>
                                                    {columns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.mappingItem}>
                                                <label>Phone *</label>
                                                <select
                                                    value={columnMapping.phone}
                                                    onChange={e => setColumnMapping({ ...columnMapping, phone: e.target.value })}
                                                >
                                                    <option value="">-- Select --</option>
                                                    {columns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.mappingItem}>
                                                <label>Email</label>
                                                <select
                                                    value={columnMapping.email}
                                                    onChange={e => setColumnMapping({ ...columnMapping, email: e.target.value })}
                                                >
                                                    <option value="">-- None --</option>
                                                    {columns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.mappingItem}>
                                                <label>Notes</label>
                                                <select
                                                    value={columnMapping.notes}
                                                    onChange={e => setColumnMapping({ ...columnMapping, notes: e.target.value })}
                                                >
                                                    <option value="">-- None --</option>
                                                    {columns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.previewSection}>
                                        <h4>Preview (first 5 rows)</h4>
                                        <table className={styles.previewTable}>
                                            <thead>
                                                <tr>
                                                    {columns.slice(0, 4).map(col => (
                                                        <th key={col}>{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedData.slice(0, 5).map((row, idx) => (
                                                    <tr key={idx}>
                                                        {columns.slice(0, 4).map(col => (
                                                            <td key={col}>{String(row[col] || "")}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {parsedData.length > 5 && (
                                            <p className={styles.moreRows}>+ {parsedData.length - 5} more rows</p>
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                {!isLoading && !importResult && file && parsedData.length > 0 && (
                    <div className={styles.footer}>
                        <div className={styles.stats}>
                            <strong>{parsedData.length}</strong> customers found
                        </div>
                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                            <button
                                className={styles.importBtn}
                                onClick={handleImport}
                                disabled={!columnMapping.name || !columnMapping.phone}
                            >
                                Import Customers
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
