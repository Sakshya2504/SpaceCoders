import { useEffect, useRef } from 'react';

/**
 * Shared modal shell used for clinician actions and confirmation dialogs.
 * Keeping focus behavior here means individual pages can stay focused on
 * their business logic rather than accessibility plumbing.
 */
export default function Modal({ open, title, onClose, children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest close callback without making the focus effect rerun on
  // every parent render. Some callers pass an inline callback, and rerunning
  // the effect was stealing focus from text fields after every keystroke.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousFocus = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        onCloseRef.current?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
