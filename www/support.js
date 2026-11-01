// Roughly how long each phone gets security updates, from the makers' published promises.
// Dates are approximate (month the promise runs out); always check the maker's own support page.
export const SUPPORT = [
  // Samsung (model codes from Settings → About phone, e.g. SM-S921B)
  [/^SM-S93[0-8]/, 'Galaxy S25 series', '2032-01'],
  [/^SM-S92[0-8]/, 'Galaxy S24 series', '2031-01'],
  [/^SM-S721/, 'Galaxy S24 FE', '2031-10'],
  [/^SM-S91[0-8]/, 'Galaxy S23 series', '2028-02'],
  [/^SM-S711/, 'Galaxy S23 FE', '2028-10'],
  [/^SM-S90[0-8]/, 'Galaxy S22 series', '2027-02'],
  [/^SM-G99[0-8]/, 'Galaxy S21 series', '2025-01'],
  [/^SM-F946|^SM-F731/, 'Galaxy Z Fold5 / Flip5', '2028-08'],
  [/^SM-F956|^SM-F741/, 'Galaxy Z Fold6 / Flip6', '2031-07'],
  [/^SM-F966|^SM-F766/, 'Galaxy Z Fold / Flip 7', '2032-07'],
  [/^SM-A[235]66/, 'Galaxy A26 / A36 / A56', '2031-03'],
  [/^SM-A16[56]/, 'Galaxy A16', '2030-10'],
  [/^SM-A[35]56/, 'Galaxy A35 / A55', '2029-03'],
  [/^SM-A15[56]|^SM-A256/, 'Galaxy A15 / A25', '2028-12'],
  [/^SM-A[35]46/, 'Galaxy A34 / A54', '2028-03'],
  [/^SM-A14[56]/, 'Galaxy A14', '2028-01'],
  [/^SM-A[0-9]{2}[0-5]/, 'Older Galaxy A phone', '2025-12'],
  // Google Pixel (model names)
  [/^Pixel 10/, 'Pixel 10 series', '2032-08'],
  [/^Pixel 9a/, 'Pixel 9a', '2032-04'],
  [/^Pixel 9/, 'Pixel 9 series', '2031-08'],
  [/^Pixel 8a/, 'Pixel 8a', '2031-05'],
  [/^Pixel 8/, 'Pixel 8 series', '2030-10'],
  [/^Pixel 7a/, 'Pixel 7a', '2028-05'],
  [/^Pixel 7/, 'Pixel 7 series', '2027-10'],
  [/^Pixel 6a/, 'Pixel 6a', '2027-07'],
  [/^Pixel 6/, 'Pixel 6 series', '2026-10'],
  [/^Pixel [1-5]/, 'Older Pixel', '2023-12'],
];

/** The phone's support entry, if GuardYourPhone knows it. */
export function supportFor(model = '') {
  const m = String(model).trim();
  const hit = SUPPORT.find(([re]) => re.test(m));
  return hit ? { name: hit[1], until: hit[2], ended: Date.parse(`${hit[2]}-28`) < Date.now() } : null;
}

/** The newest monthly patch a supported phone should have (Android patches come out early each month). */
export function expectedPatch(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - (now.getDate() < 10 ? 1 : 0), 1);
  return d;
}

export const monthName = (d) => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** How to update, by maker. */
export function howToUpdate(maker = '') {
  const m = String(maker).toLowerCase();
  if (m === 'samsung') return ['Turn off any VPN, connect to Wi-Fi and charge above 50%.', 'Settings → Software update → Download and install. Repeat until it says you are up to date.', 'Settings → Security and privacy → Updates → Google Play system update.', 'If nothing is offered: install Samsung Smart Switch on a computer (samsung.com/smart-switch), plug the phone in and press Update. Or visit a Samsung service centre or your carrier.', 'Turn on Settings → Software update → Auto download over Wi-Fi.'];
  if (m === 'google') return ['Connect to Wi-Fi and charge above 50%.', 'Settings → System → Software updates → System update.', 'Settings → Security & privacy → Updates → Google Play system update.'];
  return ['Connect to Wi-Fi and charge above 50%.', 'Settings → System → System update (or Settings → About phone → Software update).', 'Settings → Security → Google Play system update.', 'If nothing is offered, ask the shop or your carrier, or check the maker’s website for your model.'];
}
