/**
 * Short two-note chime for new orders / deliveries (Web Audio, no sound files).
 * Browsers only allow sound after the user has tapped something, so the desk has a "Sound on" button
 * that calls unlockChime() from that tap; the choice is remembered on this device.
 */
const KEY = 'alerts.sound';
let ctx = null;

export const soundEnabled = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

export function setSoundEnabled(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (on) unlockChime();
}

export function unlockChime() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
}

export function playChime() {
  if (!soundEnabled() || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  [[880, 0], [1318.5, 0.16]].forEach(([freq, at]) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at); osc.stop(now + at + 0.5);
  });
}
