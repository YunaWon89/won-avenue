import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export const MAX_REVIEW_PHOTOS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Photos under a review; tap one to see it large. */
export function ReviewPhotoStrip({ urls = [] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!urls.length) return null;
  return (
    <>
      <div className="review-photos">
        {urls.map((u, i) => (
          <button key={u} type="button" onClick={() => setOpen(i)} aria-label={`${t('review.photoAlt')} ${i + 1}`}>
            <img src={u} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && createPortal(
        <div className="photo-lightbox" role="dialog" aria-label={t('review.photoAlt')} onClick={() => setOpen(null)}>
          <img src={urls[open]} alt={t('review.photoAlt')} />
          <button type="button" className="photo-lightbox-close" aria-label="×">×</button>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Photo picker for the review form: up to 3 images (JPG / PNG / WEBP, ≤ 2 MB), with previews. */
export function ReviewPhotoPicker({ files, onChange }) {
  const { t } = useTranslation();
  const input = useRef(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const pick = (e) => {
    const chosen = [...e.target.files];
    e.target.value = '';
    const bad = chosen.find((f) => !TYPES.includes(f.type));
    const big = chosen.find((f) => f.size > MAX_BYTES);
    if (bad) setError(t('errors.INVALID_FILE_TYPE'));
    else if (big) setError(t('errors.FILE_TOO_LARGE'));
    else setError('');
    const ok = chosen.filter((f) => TYPES.includes(f.type) && f.size <= MAX_BYTES);
    const next = [...files, ...ok].slice(0, MAX_REVIEW_PHOTOS);
    if (files.length + ok.length > MAX_REVIEW_PHOTOS) setError(t('errors.TOO_MANY_PHOTOS'));
    onChange(next);
  };
  return (
    <div className="photo-picker">
      <div className="photo-picker-row">
        {previews.map((u, i) => (
          <div key={u} className="photo-picker-item">
            <img src={u} alt="" />
            <button type="button" aria-label={t('review.removePhoto')} onClick={() => onChange(files.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        {files.length < MAX_REVIEW_PHOTOS && (
          <button type="button" className="photo-picker-add" onClick={() => input.current?.click()}>
            <span aria-hidden>📷</span>{t('review.addPhotos')}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
      <p className={error ? 'field-error' : 'muted small'}>{error || t('review.photosHint')}</p>
    </div>
  );
}
