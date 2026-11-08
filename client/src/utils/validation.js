/**
 * Small client-side validators. Each returns an i18n key (or [key, params]) or undefined.
 * The server validates everything again — these exist for instant feedback.
 */
export const rules = {
  required: (v) => (v === undefined || v === null || String(v).trim() === '' ? 'errors.required' : undefined),
  email: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'errors.email' : undefined),
  password: (v) => (v && (v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) ? 'errors.password' : undefined),
  name: (v) => (v && (v.trim().length < 2 || v.trim().length > 50) ? 'errors.name' : undefined),
  phone: (v) => (v && !/^\+?[0-9\s\-()]{9,20}$/.test(v) ? 'errors.phone' : undefined),
  price: (v) => (v !== '' && v !== undefined && (!Number.isInteger(Number(v)) || Number(v) <= 0) ? 'errors.price' : undefined),
  min: (n) => (v) => (v && v.trim().length < n ? ['errors.minLength', { min: n }] : undefined),
  max: (n) => (v) => (v && v.length > n ? ['errors.maxLength', { max: n }] : undefined),
};

/**
 * validate({ email: [rules.required, rules.email] }, values) -> { email: 'errors.email' }
 */
export function validate(schema, values) {
  const errors = {};
  Object.entries(schema).forEach(([field, fns]) => {
    for (const fn of fns) {
      const err = fn(values[field], values);
      if (err) { errors[field] = err; break; }
    }
  });
  return errors;
}

/** Translate an error value produced by validate() or returned by the API. */
export function errorText(t, err) {
  if (!err) return undefined;
  if (Array.isArray(err)) return t(err[0], err[1]);
  return err.startsWith('errors.') ? t(err) : err;
}

/** Best user-facing message for an ApiError. */
export function apiErrorMessage(t, err) {
  if (!err) return t('errors.generic');
  if (err.code === 'NETWORK') return t('errors.network');
  if (err.code && t(`errors.${err.code}`, { defaultValue: '' })) return t(`errors.${err.code}`);
  if (err.status >= 500) return t('errors.generic');
  return err.message || t('errors.generic');
}
