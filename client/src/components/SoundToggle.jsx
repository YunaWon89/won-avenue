import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { setSoundEnabled, soundEnabled, unlockChime, playChime } from '../utils/chime';

/** "Sound on / off" for new orders (owner desk) and new deliveries (courier). */
export default function SoundToggle() {
  const { t } = useTranslation();
  const [on, setOn] = useState(soundEnabled);

  // Sound was turned on earlier: unlock audio on the first tap anywhere (browser autoplay rules).
  useEffect(() => {
    if (!on) return undefined;
    const unlock = () => unlockChime();
    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, [on]);

  const toggle = () => {
    const next = !on;
    setSoundEnabled(next);
    setOn(next);
    if (next) setTimeout(playChime, 50); // short preview so people know what it sounds like
  };
  return (
    <button type="button" className={`btn btn-sm ${on ? 'btn-secondary' : 'btn-ghost'}`} onClick={toggle} aria-pressed={on} title={t('alerts.soundHint')}>
      {on ? '🔔' : '🔕'} {on ? t('alerts.soundOn') : t('alerts.soundOff')}
    </button>
  );
}
