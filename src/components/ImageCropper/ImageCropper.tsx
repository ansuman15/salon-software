'use client';

import { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import styles from './ImageCropper.module.css';

interface ImageCropperProps {
    onImageCropped: (croppedImageBlob: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number;
    title?: string;
}

function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number
): Crop {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight
        ),
        mediaWidth,
        mediaHeight
    );
}

export default function ImageCropper({
    onImageCropped,
    onCancel,
    aspectRatio = 1, // Default 1:1 for square
    title = 'Crop Image'
}: ImageCropperProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isProcessing, setIsProcessing] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result?.toString() || null);
            });
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, aspectRatio));
    }, [aspectRatio]);

    const getCroppedImage = useCallback(async () => {
        if (!imgRef.current || !completedCrop) return null;

        const image = imgRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // Set canvas size to crop size
        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;

        ctx.drawImage(
            image,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return new Promise<Blob | null>((resolve) => {
            canvas.toBlob(
                (blob) => resolve(blob),
                'image/jpeg',
                0.9
            );
        });
    }, [completedCrop]);

    const handleCrop = async () => {
        setIsProcessing(true);
        try {
            const croppedBlob = await getCroppedImage();
            if (croppedBlob) {
                onImageCropped(croppedBlob);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setImageSrc(null);
        setCrop(undefined);
        setCompletedCrop(undefined);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>{title}</h3>
                    <button className={styles.closeBtn} onClick={onCancel}>×</button>
                </div>

                <div className={styles.content}>
                    {!imageSrc ? (
                        <div className={styles.uploadArea}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={onSelectFile}
                                className={styles.fileInput}
                                id="image-upload"
                            />
                            <label htmlFor="image-upload" className={styles.uploadLabel}>
                                <span className={styles.uploadIcon}>📷</span>
                                <span>Click to select an image</span>
                                <span className={styles.uploadHint}>JPG, PNG up to 5MB</span>
                            </label>
                        </div>
                    ) : (
                        <div className={styles.cropArea}>
                            <ReactCrop
                                crop={crop}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                onComplete={(c) => setCompletedCrop(c)}
                                aspect={aspectRatio}
                                className={styles.reactCrop}
                            >
                                <img
                                    ref={imgRef}
                                    alt="Crop preview"
                                    src={imageSrc}
                                    onLoad={onImageLoad}
                                    className={styles.cropImage}
                                />
                            </ReactCrop>
                        </div>
                    )}
                </div>

                <div className={styles.actions}>
                    {imageSrc && (
                        <button className={styles.resetBtn} onClick={handleReset}>
                            Choose Different
                        </button>
                    )}
                    <button className={styles.cancelBtn} onClick={onCancel}>
                        Cancel
                    </button>
                    {imageSrc && (
                        <button
                            className={styles.cropBtn}
                            onClick={handleCrop}
                            disabled={!completedCrop || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Crop & Save'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
