import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_ENGLISH, LANGUAGE_NAMES, detectLanguage, markLanguageChosen } from '../i18n';
import { usePassport } from '../context/PassportContext';
import { LogoFull } from '../components/Logo';

const GREETINGS = ['Hello!', '안녕하세요!', '你好！', 'Xin chào!', 'สวัสดี!', 'Привет!', 'こんにちは！', 'Hello!'];

/** First visit: pick a language (English is the default). */
export default function Welcome() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { configured, usable } = usePassport();

  const next = () => {
    markLanguageChosen();
    navigate(usable && !configured ? '/passport?onboarding=1' : '/', { replace: true });
  };

  return (
    <div className="container narrow welcome">
      <div className="welcome-hero">
        <div className="welcome-logo"><LogoFull width={150} /></div>
        <div className="greet" aria-hidden><ul>{GREETINGS.map((g, i) => <li key={i}>{g}</li>)}</ul></div>
        <p className="welcome-sub">{t('welcome.subtitle')}</p>
      </div>
      <h1 className="sr-only">{t('welcome.title')}</h1>
      <div className="lang-list" role="radiogroup" aria-label={t('welcome.title')}>
        {LANGUAGES.map((l, i) => (
          <button key={l} type="button" role="radio" aria-checked={i18n.language === l} style={{ animationDelay: `${i * 60}ms` }}
            className={`lang-row ${i18n.language === l ? 'is-active' : ''}`} onClick={() => i18n.changeLanguage(l)}>
            <span className="lang-code">{l.toUpperCase()}</span>
            <span className="lang-name" lang={l}>{LANGUAGE_NAMES[l]}</span>
            <small>{i18n.language === l ? '✓' : ''} {l === detectLanguage() ? `📱 ${t('welcome.phone')}` : l === 'en' ? '' : LANGUAGE_ENGLISH[l]}</small>
          </button>
        ))}
      </div>
      <div className="sticky-cta">
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={next}>{t('welcome.continue')} →</button>
      </div>
    </div>
  );
}
