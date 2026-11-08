/**
 * "Magic" fly to cart: the dish (its photo, or an emoji) travels along an arc from the tapped button
 * to the visible cart icon, leaving a short trail of golden sparkles; the cart glows and bounces.
 * Cheap on slow phones: ~30 short-lived particles, transform/opacity only. Skipped for reduced motion.
 */
const rand = (a, b) => a + Math.random() * (b - a);
const MAX_SPARKS = 34;

function spark(x, y, { dx = rand(-16, 16), dy = rand(-20, 10), life = rand(450, 800), size = rand(7, 13) } = {}) {
  const s = document.createElement('i');
  s.className = 'fly-spark';
  s.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
  document.body.appendChild(s);
  const anim = s.animate([
    { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2) rotate(90deg)`, opacity: 0 },
  ], { duration: life, easing: 'cubic-bezier(.2,.7,.3,1)' });
  anim.onfinish = () => s.remove();
}

export function flyToCart(sourceEl, emoji = '🍽️', imageUrl = null) {
  const target = [...document.querySelectorAll('[data-cart-target]')].find((el) => el.offsetParent !== null);
  if (!sourceEl || !target) return;
  const arrive = () => {
    target.classList.remove('bump');
    void target.offsetWidth; // restart the CSS animation
    target.classList.add('bump');
  };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { arrive(); return; }

  const a = sourceEl.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const cx = (x0 + x1) / 2 - 50, cy = Math.min(y0, y1) - 130; // arc up and over

  const el = document.createElement('span');
  el.className = 'fly-emoji';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl; img.alt = '';
    el.classList.add('has-photo');
    el.appendChild(img);
  } else {
    el.textContent = emoji;
  }
  document.body.appendChild(el);

  let sparks = 0;
  for (let i = 0; i < 6; i += 1, sparks += 1) spark(x0, y0, { dx: rand(-26, 26), dy: rand(-26, 16) });
  const duration = 900; const t0 = performance.now(); let last = 0;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

  const frame = (now) => {
    const t = Math.min(1, (now - t0) / duration); const e = ease(t);
    const x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * x1;
    const y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * y1;
    const scale = 1 + Math.sin(t * Math.PI) * 0.3 - t * 0.6;
    el.style.transform = `translate(${x - 20}px, ${y - 20}px) scale(${scale}) rotate(${t * (imageUrl ? 40 : 280)}deg)`;
    if (now - last > 30 && sparks < MAX_SPARKS - 12) { last = now; sparks += 1; spark(x, y); }
    if (t < 1) { requestAnimationFrame(frame); return; }
    el.remove();
    const ring = document.createElement('i');
    ring.className = 'fly-ring';
    ring.style.cssText = `left:${x1}px;top:${y1}px`;
    document.body.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove());
    for (let i = 0; i < 10; i += 1) {
      const g = (i / 10) * Math.PI * 2;
      spark(x1, y1, { dx: Math.cos(g) * rand(18, 32), dy: Math.sin(g) * rand(18, 32), size: rand(6, 10) });
    }
    arrive();
  };
  requestAnimationFrame(frame);
}
