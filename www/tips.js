// GuardYourPhone hover info: point at any button or link (computer), tab to it (keyboard), or press and hold it
// for half a second (phone) to see what it does. Text comes from data-tip, then this list, then
// (for links) where the link goes. Built with textContent only — no HTML.
const TIPS = {
  'Check my phone': 'Run the security check-up (reads settings only, changes nothing)',
  'Check again': 'Run the security check-up again',
  'Update now': 'Open the system update screen',
  'Check for updates': 'Open the system update screen',
  'What to do': 'See what to do when a phone gets no more updates',
  'App settings': 'Open this app’s settings to see or remove its permissions',
  Uninstall: 'Ask Android to remove this app (Android asks you to confirm)',
  'Check mobile network': 'See which network and towers your phone is using (2G warning)',
  'Mobile network settings': 'Open mobile network settings, e.g. to turn off 2G',
  'Copy report': 'Copy the report to send to someone who helps you with your phone',
  'Developer options': 'Open Developer options to turn off USB debugging',
  'Security settings': 'Open your phone’s security settings',
  'Open Settings': 'Open your phone’s Settings',
  'Set a screen lock': 'Open screen lock settings to set a PIN',
  'How to restart': 'Show how to restart your phone',
};
const PREFIX = [];

const tip = document.createElement('div');
tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'gyp-tip'; tip.hidden = true;

function textFor(el) {
  if (el.dataset.tip) return el.dataset.tip;
  const label = (el.getAttribute('aria-label') && !TIPS[el.textContent.trim()] ? el.getAttribute('aria-label') : el.textContent).replace(/\s+/g, ' ').trim();
  if (TIPS[label]) return TIPS[label];
  for (const [re, t] of PREFIX) if (re.test(label)) return t;
  if (el.tagName === 'A' && el.href) {
    try {
      const u = new URL(el.href);
      if (/(^|\.)wa\.me$|whatsapp\.com$/.test(u.hostname)) return 'Opens WhatsApp';
      if (/openstreetmap\.org$/.test(u.hostname)) return 'Opens OpenStreetMap, who make the map';
      if (u.origin !== location.origin) return `Opens ${u.hostname.replace(/^www\./, '')} in a new tab`;
    } catch { /* not a URL */ }
  }
  return null;
}

let current = null, hideTimer = null, press = null;
function show(el) {
  const t = textFor(el);
  if (!t) return;
  current = el;
  if (!tip.isConnected) document.body.append(tip);
  tip.textContent = t; tip.hidden = false;
  el.setAttribute('aria-describedby', 'gyp-tip');
  const host = el.closest('dialog[open]') || document.body; // inside a dialog, the tip must live there to show on top
  if (tip.parentNode !== host) host.append(tip);
  const r = el.getBoundingClientRect(), w = Math.min(280, innerWidth - 16);
  tip.style.maxWidth = `${w}px`;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const x = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
  let y = r.top - th - 8; if (y < 8) y = r.bottom + 8;
  tip.style.left = `${x}px`; tip.style.top = `${y}px`;
}
function hide() { current?.removeAttribute('aria-describedby'); current = null; tip.hidden = true; }
const target = (e) => e.target.closest?.('[data-tip], a[href], button, summary');

export function installTips() {
  document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') { const el = target(e); if (el && el !== current) show(el); } });
  document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && current && !current.contains(e.relatedTarget)) hide(); });
  document.addEventListener('focusin', (e) => { const el = target(e); if (el && el.matches(':focus-visible')) show(el); });
  document.addEventListener('focusout', hide);
  document.addEventListener('click', hide, true);
  addEventListener('scroll', hide, { passive: true, capture: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  // Phones: press and hold to see what a button does.
  document.addEventListener('touchstart', (e) => {
    const el = target(e); if (!el) return;
    clearTimeout(press); press = setTimeout(() => { show(el); clearTimeout(hideTimer); hideTimer = setTimeout(hide, 2500); }, 500);
  }, { passive: true });
  for (const ev of ['touchend', 'touchmove', 'touchcancel']) document.addEventListener(ev, () => clearTimeout(press), { passive: true });
}
