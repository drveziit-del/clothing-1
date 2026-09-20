'use client';

import { ReactNode } from 'react';
import { useFocusTrap } from '@/lib/utils/useFocusTrap';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, children, maxWidth = '560px' }: ModalProps) {
  const overlayRef = useFocusTrap<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className={styles.panel} style={{ maxWidth }}>
        <div className={styles.header}>
          {title && <h2 id="modal-title" className={styles.title}>{title}</h2>}
          <button onClick={onClose} className={styles.closeBtn} aria-label="Close modal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
