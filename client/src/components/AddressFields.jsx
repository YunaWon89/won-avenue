import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Modal, Spinner } from './ui';

const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loader;
function loadPostcode() {
  if (window.daum?.Postcode) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = POSTCODE_SRC;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { loader = null; reject(new Error('postcode script failed')); };
      document.head.appendChild(s);
    });
  }
  return loader;
}

/** Kakao (Daum) postcode search embedded in a modal. Free, no API key. */
function PostcodeModal({ open, onClose, onSelect }) {
  const { t, i18n } = useTranslation();
  const box = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFailed(false);
    loadPostcode().then(() => {
      if (!box.current) return;
      box.current.innerHTML = '';
      new window.daum.Postcode({
        oncomplete: (data) => {
          const english = i18n.language !== 'ko' && data.roadAddressEnglish;
          const road = english ? data.roadAddressEnglish : data.roadAddress || data.jibunAddress;
          const extra = !english && data.buildingName ? ` (${data.buildingName})` : '';
          onSelect({ postalCode: data.zonecode, addressLine1: `${road}${extra}` });
          onClose();
        },
        width: '100%',
        height: '100%',
      }).embed(box.current);
    }).catch(() => setFailed(true));
  }, [open, onSelect, onClose, i18n.language]);

  return (
    <Modal open={open} onClose={onClose} title={t('address.searchTitle')}>
      {failed ? <p className="muted">{t('errors.network')}</p> : (
        <div className="postcode-box" ref={box}><div className="state"><Spinner /></div></div>
      )}
    </Modal>
  );
}

/**
 * Korean address input: postcode search fills postal code + road address,
 * the user types the detail (동/호수). Manual entry is still possible.
 */
export function AddressFields({ value, onChange, errors = {}, required }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="address-fields">
      <div className="address-row">
        <Input label={t('address.postalCode')} value={value.postalCode || ''} inputMode="numeric" maxLength={5}
          onChange={(e) => set({ postalCode: e.target.value.replace(/\D/g, '') })} error={errors.postalCode} className="postal" />
        <button type="button" className="btn btn-secondary address-search-btn" onClick={() => setOpen(true)}>🔍 {t('address.search')}</button>
      </div>
      <Input label={t('address.line1')} required={required} value={value.addressLine1 || ''} onChange={(e) => set({ addressLine1: e.target.value })}
        error={errors.addressLine1} autoComplete="street-address" onFocus={() => !value.addressLine1 && setOpen(true)} />
      <Input label={t('address.line2')} value={value.addressLine2 || ''} placeholder={t('address.line2Placeholder')}
        onChange={(e) => set({ addressLine2: e.target.value })} error={errors.addressLine2} />
      <PostcodeModal open={open} onClose={() => setOpen(false)} onSelect={set} />
    </div>
  );
}
