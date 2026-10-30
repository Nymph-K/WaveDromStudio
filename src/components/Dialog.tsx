import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../lib/useI18n';

interface DialogProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function Dialog({ title, subtitle, icon, children, footer, onClose, width = 'md', className = '' }: DialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.target instanceof Element && event.target.closest('.key-capture')) return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    const focusTimer = window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      // querySelector returns the first match in document order, so a selector
      // list would focus the header close button before a form field.
      const target = card.querySelector<HTMLElement>('[data-autofocus]')
        || card.querySelector<HTMLElement>('input:not([type="hidden"])')
        || card.querySelector<HTMLElement>('textarea')
        || card.querySelector<HTMLElement>('select')
        || card.querySelector<HTMLElement>('button.primary')
        || card.querySelector<HTMLElement>('button');
      if (!target) return;
      target.focus();
      if (target instanceof HTMLInputElement && target.hasAttribute('data-autofocus')) {
        target.select();
      }
    }, 40);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKey, true);
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="dialog-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`dialog-card dialog-${width} ${className}`} ref={cardRef} role="dialog" aria-modal="true" aria-label={title}>
        <header className="dialog-head">
          <div className="dialog-title-wrap">
            {icon && <div className="dialog-icon">{icon}</div>}
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t('Close dialog')}>
            <X size={17} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
