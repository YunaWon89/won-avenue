import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_NAMES } from '../i18n';
import { localized } from '../utils/format';
import { ReviewPhotoStrip } from './ReviewPhotos';

/**
 * A review comment in the reader's language. Reviews are translated once when posted
 * (source language detected from the text); the reader can switch to the original.
 */
export default function ReviewText({ review, className = '' }) {
  const { t, i18n } = useTranslation();
  const [original, setOriginal] = useState(false);
  if (!review?.comment) return <ReviewPhotoStrip urls={review?.photoUrls} />;
  const tr = localized(review, 'comment', i18n.language, original);
  const canSwitch = review.sourceLanguage && review.sourceLanguage !== i18n.language && review.translations?.[i18n.language]?.comment;
  return (
    <div className={`review-text ${className}`}>
      <p lang={original || !tr.translated ? review.sourceLanguage || undefined : i18n.language}>{tr.text}</p>
      {canSwitch && (
        <p className="review-tr muted small">
          🌐 {original ? t('review.originalIn', { lang: LANGUAGE_NAMES[review.sourceLanguage] || review.sourceLanguage }) : t('review.translatedFrom', { lang: LANGUAGE_NAMES[review.sourceLanguage] || review.sourceLanguage })}
          {' · '}
          <button type="button" className="link-btn small" onClick={() => setOriginal((o) => !o)}>
            {original ? t('review.showTranslation') : t('review.showOriginal')}
          </button>
        </p>
      )}
      <ReviewPhotoStrip urls={review.photoUrls} />
    </div>
  );
}
