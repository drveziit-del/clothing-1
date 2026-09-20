'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible Focus Trap Hook (WCAG 2.4.3)
 * - Traps Tab and Shift+Tab strictly within the modal container.
 * - Listens for Escape and invokes onClose callback.
 * - Automatically moves focus to the first interactive element (or container if none).
 * - Restores focus to the triggering element upon modal unmount/dismissal.
 * - Handles zero-focusable-elements safely.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  isOpen: boolean,
  onClose?: () => void
) {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Record the element that triggered the modal for restoration
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    const container = containerRef.current;
    if (!container) return;

    // Lock body scroll while modal is active
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Find all visible, focusable elements
    const getFocusables = () => {
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
      );
    };

    // Move initial focus into modal on next animation frame
    const rafId = requestAnimationFrame(() => {
      const focusables = getFocusables();
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        // Safe fallback when zero focusable elements exist
        if (!container.hasAttribute('tabindex')) {
          container.setAttribute('tabindex', '-1');
        }
        container.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusables();
        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: if on first element or outside container, loop to last
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: if on last element or outside container, loop to first
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Restore focus to triggering element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  return containerRef;
}
