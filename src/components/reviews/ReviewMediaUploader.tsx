'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useRef } from 'react';
import { generateVideoThumbnail } from '@/lib/utils/videoThumbnail';
import type { ReviewMedia } from '@/types';
import styles from './ReviewMediaUploader.module.css';

interface ReviewMediaUploaderProps {
  mediaList: ReviewMedia[];
  onChange: (mediaList: ReviewMedia[]) => void;
  maxFiles?: number;
  token?: string;
}

export default function ReviewMediaUploader({
  mediaList,
  onChange,
  maxFiles = 4,
  token,
}: ReviewMediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);

    const remainingSlots = maxFiles - mediaList.length;
    if (remainingSlots <= 0) {
      setErrorMsg(`You can upload a maximum of ${maxFiles} photos or videos.`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);
    setUploadProgress(10);

    const uploadedItems: ReviewMedia[] = [];
    let failedCount = 0;
    let lastError = '';

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const isVideo = file.type.startsWith('video/');

      // Generate video thumbnail on client side before/during upload
      let clientThumbnail = '';
      if (isVideo) {
        try {
          clientThumbnail = await generateVideoThumbnail(file);
        } catch (thumbErr) {
          console.warn('[ReviewMediaUploader] Thumbnail extraction warning:', thumbErr);
        }
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        setUploadProgress(20 + Math.round(((i + 1) / filesToUpload.length) * 70));
        const headers: Record<string, string> = {};
        if (token) {
          headers['x-review-token'] = token;
        }
        const res = await fetch('/api/reviews/upload', {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Upload failed');
        }

        const data = await res.json();
        if (data.url) {
          uploadedItems.push({
            type: data.type || (isVideo ? 'video' : 'image'),
            url: data.url,
            playbackUrl: data.url,
            originalUrl: data.downloadUrl || data.url,
            thumbnailUrl: clientThumbnail || data.thumbnailUrl || undefined,
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : 'Upload failed';
        lastError = msg;
        console.error('[ReviewMediaUploader] File upload error:', err);
      }
    }

    if (failedCount > 0) {
      if (uploadedItems.length > 0) {
        setErrorMsg(`${uploadedItems.length} file(s) uploaded, ${failedCount} failed (${lastError}).`);
      } else {
        setErrorMsg(lastError || 'Failed to upload files. Please check file format and size.');
      }
    }

    if (uploadedItems.length > 0) {
      onChange([...mediaList, ...uploadedItems]);
    }

    setUploading(false);
    setUploadProgress(100);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (indexToRemove: number) => {
    onChange(mediaList.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className={styles.uploaderRoot}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif,video/mp4,video/webm,video/quicktime"
        multiple
        className={styles.hiddenInput}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading || mediaList.length >= maxFiles}
      />

      {mediaList.length === 0 ? (
        /* Prominent Hero Dropzone when empty */
        <button
          type="button"
          className={`${styles.heroDropzone} ${uploading ? styles.uploading : ''}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <div className={styles.uploadingState}>
              <div className={styles.spinner} />
              <span>Uploading media ({uploadProgress}%)…</span>
            </div>
          ) : (
            <div className={styles.heroContent}>
              <span className={styles.heroIcon}>+ PHOTO / VIDEO</span>
              <span className={styles.heroTitle}>Show us how you wear GERKINK</span>
              <span className={styles.heroSub}>JPG, PNG, MP4 · up to 30MB (Optional)</span>
            </div>
          )}
        </button>
      ) : (
        /* Thumbnails Strip when media is present */
        <div className={styles.thumbStrip}>
          {mediaList.map((item, idx) => (
            <div key={idx} className={styles.thumbCard}>
              {item.type === 'video' ? (
                item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={`Video upload ${idx + 1}`} className={styles.thumbMedia} />
                ) : (
                  <video
                    src={item.url}
                    className={styles.thumbMedia}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedMetadata={(e) => {
                      try {
                        e.currentTarget.currentTime = 0.05;
                      } catch {}
                    }}
                  />
                )
              ) : (
                <img src={item.url} alt={`Upload ${idx + 1}`} className={styles.thumbMedia} />
              )}

              {item.type === 'video' && (
                <div className={styles.videoBadgeWrap}>
                  <span className={styles.playIconMini}>▶</span>
                  <span className={styles.videoBadge}>VIDEO</span>
                </div>
              )}

              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeMedia(idx)}
                title="Remove media"
                aria-label="Remove media"
              >
                ✕
              </button>
            </div>
          ))}

          {mediaList.length < maxFiles && (
            <button
              type="button"
              className={styles.addMoreBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className={styles.spinner} />
              ) : (
                <>
                  <span className={styles.plusIcon}>+</span>
                  <span className={styles.addMoreText}>Add more ({mediaList.length}/{maxFiles})</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {errorMsg && <div className={styles.errorBanner}>{errorMsg}</div>}
    </div>
  );
}
