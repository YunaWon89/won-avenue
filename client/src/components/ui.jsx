import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { errorText, apiErrorMessage } from '../utils/validation';

// ---------- Form fields ----------
export function Field({ label, error, hint, children, required, htmlFor, className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}{required && <span className="req" aria-hidden> *</span>}
        </label>
      )}
      {children}
      {error ? <p className="field-error" role="alert">{errorText(t, error)}</p> : hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function Input({ label, error, hint, required, className, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={id} className={className}>
      <input id={id} className="input" aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Textarea({ label, error, hint, required, className, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={id} className={className}>
      <textarea id={id} className="input textarea" aria-invalid={Boolean(error)} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, required, children, className, ...props }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} required={required} htmlFor={id} className={className}>
      <select id={id} className="input select" aria-invalid={Boolean(error)} {...props}>{children}</select>
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} {...props} />
      <span className="checkbox-box" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ label, checked, onChange, disabled }) {
  return (
    <label className={`switch ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden><span className="switch-thumb" /></span>
      {label && <span>{label}</span>}
    </label>
  );
}

/** Toggleable chip, used for filters and tag pickers. */
export function Chip({ active, onClick, children, tone, size, ...props }) {
  return (
    <button type="button" className={`chip ${active ? 'is-active' : ''} ${tone ? `chip-${tone}` : ''} ${size === 'sm' ? 'chip-sm' : ''}`}
      aria-pressed={active} onClick={onClick} {...props}>
      {children}
    </button>
  );
}

/** Segmented control: [{ value, label }] */
export function Segmented({ value, onChange, options, ariaLabel }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled}
          className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <span aria-hidden>{o.icon}</span>}{o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Feedback ----------
export const Spinner = ({ size = 22 }) => <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="loading" />;

export function Loading() {
  const { t } = useTranslation();
  return <div className="state"><Spinner size={28} /><p>{t('common.loading')}</p></div>;
}

export function EmptyState({ icon = '🍽️', title, text, action }) {
  return (
    <div className="state">
      <div className="state-icon" aria-hidden>{icon}</div>
      {title && <h3>{title}</h3>}
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="state">
      <div className="state-icon" aria-hidden>😕</div>
      <p>{apiErrorMessage(t, error)}</p>
      {onRetry && <button type="button" className="btn btn-secondary" onClick={() => onRetry()}>{t('common.retry')}</button>}
    </div>
  );
}

export function Alert({ tone = 'info', children }) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}

// ---------- Overlays ----------
export function Modal({ open, onClose, title, children, footer, size }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, text, confirmLabel, danger, busy, onConfirm, onCancel }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner size={16} /> : confirmLabel || t('common.confirm')}
          </button>
        </>
      )}>
      <p className="muted">{text}</p>
    </Modal>
  );
}

// ---------- Data display ----------
export function Pagination({ page, totalPages, onChange }) {
  const { t } = useTranslation();
  if (!totalPages || totalPages <= 1) return null;
  const pages = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(totalPages, from + 4);
  for (let p = from; p <= to; p += 1) pages.push(p);
  return (
    <nav className="pagination" aria-label="pagination">
      <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('common.prev')}>‹</button>
      {pages.map((p) => (
        <button key={p} type="button" className={`page-btn ${p === page ? 'is-active' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button type="button" className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label={t('common.next')}>›</button>
    </nav>
  );
}

export function Stars({ value = 0, size = 'md' }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className={`stars stars-${size}`} aria-label={`${value} / 5`}>
      <span className="stars-bg">★★★★★</span>
      <span className="stars-fg" style={{ width: `${pct}%` }}>★★★★★</span>
    </span>
  );
}

export function Rating({ value, count }) {
  const { t } = useTranslation();
  // No reviews yet: "New" instead of a misleading 0.0
  if (count === 0) return <span className="rating rating-new">✨ {t('common.newPlace')}</span>;
  return (
    <span className="rating">
      <span className="rating-star" aria-hidden>★</span>
      <strong>{Number(value || 0).toFixed(1)}</strong>
      {count !== undefined && <span className="muted">({count})</span>}
    </span>
  );
}

const STATUS_TONE = {
  pending: 'amber', accepted: 'blue', preparing: 'blue', ready_for_pickup: 'violet', out_for_delivery: 'violet',
  delivered: 'green', completed: 'green', cancelled: 'gray',
};
export function StatusBadge({ status }) {
  const { t } = useTranslation();
  return <span className={`badge badge-${STATUS_TONE[status] || 'gray'}`}>{t(`status.${status}`)}</span>;
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
