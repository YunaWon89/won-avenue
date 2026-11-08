import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { imageUrl } from '../api/client';
import { Field } from './ui';
import { compressImage } from '../utils/compressImage';

const MAX = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Image picker with preview and client-side type/size checks (server checks again). */
export function ImageInput({ label, current, file, onChange }) {
  const { t } = useTranslation();
  const [error, setError] = useState();
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!TYPES.includes(picked.type)) { setError(t('errors.INVALID_FILE_TYPE')); return; }
    const f = await compressImage(picked); // big phone photos become small enough to upload
    if (f.size > MAX) { setError(t('errors.FILE_TOO_LARGE')); return; }
    setError(undefined);
    onChange(f);
  };

  const shown = preview || imageUrl(current);
  return (
    <Field label={label} error={error} hint="JPG · PNG · WEBP, ≤ 2 MB">
      <label className="image-input">
        {shown ? <img src={shown} alt="" /> : <span className="image-input-empty">📷</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} />
        <span className="image-input-cta">{shown ? t('common.edit') : t('common.add')}</span>
      </label>
    </Field>
  );
}
