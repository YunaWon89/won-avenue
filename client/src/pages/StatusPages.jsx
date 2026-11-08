import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="container status-page">
      <div className="status-code">404</div>
      <h1>{t('errors.notFound')}</h1>
      <p className="muted">{t('errors.notFoundText')}</p>
      <Link to="/" className="btn btn-primary">{t('errors.goHome')}</Link>
    </div>
  );
}

export function AccessDenied() {
  const { t } = useTranslation();
  return (
    <div className="container status-page">
      <div className="status-code">🔒</div>
      <h1>{t('errors.forbidden')}</h1>
      <p className="muted">{t('errors.forbiddenText')}</p>
      <Link to="/" className="btn btn-primary">{t('errors.goHome')}</Link>
    </div>
  );
}
