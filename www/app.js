// GuardYourPhone: phone security check-up. Runs entirely on the phone and sends nothing anywhere.
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v; else if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
};
const store = { get: (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } } };
function toast(m, ms = 3500) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms); }
const DAY = 86400e3;
import { supportFor, expectedPatch, monthName, howToUpdate } from './support.js';

// ---------- Capacitor (absent in a normal browser: then GuardYourPhone shows example results) ----------
let platform = 'web', Check = null, Notes = null, Device = null;
try {
  const core = await import('./capacitor-core.js');
  platform = core.Capacitor.getPlatform();
  if (platform !== 'web') {
    Check = platform === 'android' ? core.registerPlugin('GuardCheck') : null;
    Notes = core.registerPlugin('LocalNotifications');
    Device = core.registerPlugin('Device');
  }
} catch { /* browser preview */ }
const demo = platform === 'web';
$('#demo').hidden = !demo;

// ---------- example data for the browser preview ----------
const EX = {
  device: { manufacturer: 'samsung', brand: 'samsung', model: 'SM-S921B', android: '16', sdk: 36, securityPatch: '2025-10-01', baseband: 'S921BXXSACYJ7', hardware: 's5e9945', platform: 's5e9945', socManufacturer: 'Samsung', socModel: 's5e9945', bootloader: 'S921BXXSACYJ7', abis: 'arm64-v8a, armeabi-v7a, armeabi', cores: 8, kernel: '5.15.123', buildTags: 'release-keys', buildType: 'user', uptimeMs: 9.3 * DAY },
  security: { screenLock: true, encrypted: true, usbDebugging: true, developerOptions: true, autoTime: true, verifiedBoot: 'green', flashLocked: '1', vbmetaState: 'locked', warrantyBit: '0', testKeys: false, rootSigns: [], deviceAdmins: ['com.google.android.gms'], accessibility: 'com.fastcleaner.boost/.AccService', notificationListeners: '',
    userCaCerts: [], httpProxy: '', privateDnsMode: 'off', bluetoothOn: true, nfcOn: true, vpnActive: true, onWifi: true, wifiSecurity: 2, advancedProtection: false, isSamsung: true },
  apps: { total: 214, systemApps: 171, apps: [
    { package: 'com.fastcleaner.boost', name: 'Fast Cleaner Boost', installer: 'com.google.android.packageinstaller', accessibility: true, notificationListener: false, deviceAdmin: false, permissions: ['READ_SMS', 'SYSTEM_ALERT_WINDOW', 'RECORD_AUDIO'], installed: Date.now() - 20 * DAY },
    { package: 'com.whatsapp', name: 'WhatsApp', installer: 'com.android.vending', permissions: ['CAMERA', 'RECORD_AUDIO', 'READ_CONTACTS'], installed: Date.now() - 400 * DAY },
    { package: 'com.google.android.gms', name: 'Google Play services', installer: '', system: true, deviceAdmin: true, permissions: [] },
  ] },
  network: { operator: 'Digicel', simOperator: 'Digicel', country: 'bb', data: '4G', voice: '4G', roaming: false, phonePermission: true, locationPermission: true, cells: [{ registered: true, gen: '4G', cell: 21345678, area: 1201, dbm: -96 }, { registered: false, gen: '2G', cell: 4410, area: 77, dbm: -88 }] },
};

// ---------- reading the phone ----------
async function readAll() {
  if (demo) return { device: EX.device, security: EX.security, apps: EX.apps };
  if (platform === 'android') {
    const [device, security, apps] = await Promise.all([Check.device(), Check.security(), Check.apps().catch(() => null)]);
    return { device, security, apps };
  }
  // iPhone: Apple only shares the basics.
  const info = await Device.getInfo();
  return { device: { manufacturer: 'Apple', model: info.model, ios: info.osVersion, name: info.name }, security: null, apps: null };
}

const STORES = new Set(['com.android.vending', 'com.sec.android.app.samsungapps', 'com.huawei.appmarket', 'com.amazon.venezia', 'com.xiaomi.market', 'com.xiaomi.mipicks', 'com.oppo.market', 'com.heytap.market', 'com.bbk.appstore', 'com.vivo.appstore', 'com.google.android.feedback', 'com.android.chrome', 'com.transsion.store']);
const SIDE = new Set(['com.google.android.packageinstaller', 'com.android.packageinstaller', 'com.samsung.android.packageinstaller', 'com.miui.packageinstaller', '']);
const PERM_WORDS = { READ_SMS: 'read texts', RECEIVE_SMS: 'receive texts', SEND_SMS: 'send texts', RECORD_AUDIO: 'microphone', CAMERA: 'camera', ACCESS_FINE_LOCATION: 'location', ACCESS_BACKGROUND_LOCATION: 'location all the time', READ_CONTACTS: 'contacts', READ_CALL_LOG: 'call history', READ_PHONE_STATE: 'phone status', CALL_PHONE: 'make calls', BODY_SENSORS: 'body sensors', READ_EXTERNAL_STORAGE: 'files', READ_MEDIA_IMAGES: 'photos', SYSTEM_ALERT_WINDOW: 'draw over other apps', REQUEST_INSTALL_PACKAGES: 'install other apps', MANAGE_EXTERNAL_STORAGE: 'all files', QUERY_ALL_PACKAGES: 'see all apps', PACKAGE_USAGE_STATS: 'app usage', BIND_DEVICE_ADMIN: 'device admin' };
const SPY_PERMS = new Set(['READ_SMS', 'RECEIVE_SMS', 'RECORD_AUDIO', 'READ_CALL_LOG', 'ACCESS_BACKGROUND_LOCATION', 'SYSTEM_ALERT_WINDOW', 'REQUEST_INSTALL_PACKAGES', 'MANAGE_EXTERNAL_STORAGE']);

/** Apps worth a look, each with reasons and a risk level. */
function flagApps(list) {
  const out = [];
  for (const a of list?.apps || []) {
    if (a.package === 'bb.guardyourphone.app') continue;
    const side = !a.system && SIDE.has(a.installer || '') && !STORES.has(a.installer || '');
    const spy = (a.permissions || []).filter((p) => SPY_PERMS.has(p));
    const why = [];
    let level = 0;
    if (a.accessibility) { why.push('can read and control your screen (accessibility)'); level = Math.max(level, a.system ? 1 : 2); }
    if (a.deviceAdmin) { why.push('is a device administrator'); level = Math.max(level, a.system ? 0 : 2); }
    if (a.notificationListener) { why.push('can read all your notifications'); level = Math.max(level, a.system ? 0 : 1); }
    if (side) { why.push('was installed from a file, not an app store'); level = Math.max(level, spy.length ? 2 : 1); }
    if (side && spy.length) why.push(`has access to: ${spy.map((p) => PERM_WORDS[p] || p).join(', ')}`);
    if (level > 0) out.push({ ...a, why, level, side });
  }
  return out.sort((x, y) => y.level - x.level || x.name.localeCompare(y.name));
}

// Patch dates are calendar dates (YYYY-MM-DD): read them in local time so 1 October doesn't become 30 September.
const patchDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const patchAge = (s) => { const t = patchDate(s); return t ? Math.floor((Date.now() - t) / DAY) : null; };
const ago = (ms) => { const h = ms / 3600e3; return h < 1 ? 'under an hour' : h < 48 ? `${Math.round(h)} hours` : `${Math.round(h / 24)} days`; };

/** Turns what was read into findings and a 0–100 score. */
function assess({ device: d, security: s, apps }, net) {
  const f = []; let score = 100;
  const add = (level, title, text, fix, cost = 0) => { f.push({ level, title, text, fix }); score -= cost; };
  if (platform === 'ios') {
    const v = Number(String(d.ios || '').split('.')[0]);
    if (v && v < 18) add('risk', `iOS ${d.ios} is out of date`, 'Older iOS versions have known security holes. Update to the latest version.', null, 25);
    else add('ok', `iOS ${d.ios || ''}`, 'Keep automatic updates on so security fixes install quickly.');
    const done = store.get('ios-checks', {});
    const missing = IOS_CHECKS.filter((c) => !done[c.id]);
    if (missing.length) add('warn', `${missing.length} checklist items not ticked`, 'Go through the iPhone checklist below.', null, missing.length * 5);
  } else {
    if (s) {
      if (!s.screenLock) add('risk', 'No screen lock', 'Anyone who picks up your phone can open it. Set a PIN, pattern or password.', { to: 'security', label: 'Set a screen lock' }, 25);
      else add('ok', 'Screen lock is on', 'Your phone needs a PIN, pattern or password to open.');
      if (!s.encrypted) add('risk', 'Storage not encrypted', 'Your data could be read if the phone is lost. Encryption is turned on with a screen lock on most phones.', { to: 'security', label: 'Security settings' }, 15);
      if (s.rootSigns?.length) add('risk', 'Signs the phone is rooted', `Found: ${s.rootSigns.join(', ')}. Rooting removes Android’s protections and is common with stalkerware. If you didn’t root it yourself, get help.`, null, 30);
      const vb = (s.verifiedBoot || '').toLowerCase();
      if (vb && vb !== 'green') add('risk', `Verified boot is “${vb}”`, 'The phone’s system software isn’t the original, locked version from the maker. If you didn’t change it, it may have been tampered with.', null, 20);
      else if (vb === 'green') add('ok', 'Genuine system software', 'Verified boot is green: the phone started with the maker’s own signed software.');
      if (s.flashLocked === '0' || s.vbmetaState === 'unlocked') add('risk', 'Bootloader is unlocked', 'Someone can install changed system software on this phone. Unless you did this on purpose, ask the maker or a repair shop to restore and lock it.', null, 15);
      if (s.warrantyBit === '1') add('warn', 'Samsung Knox warranty flag is set', 'This phone has had unofficial software installed at some point.', null, 5);
      if (s.testKeys) add('warn', 'Built with test keys', 'This system software wasn’t signed for release. That’s unusual for a shop-bought phone.', null, 10);
      if (s.usbDebugging) add('warn', 'USB debugging is on', 'A computer plugged into your phone could install apps or copy data. Turn it off unless you’re a developer.', { to: 'developer', label: 'Developer options' }, 10);
      else if (s.developerOptions) add('warn', 'Developer options are on', 'Not dangerous by itself, but turn them off if you don’t use them.', { to: 'developer', label: 'Developer options' }, 3);
      if (!s.autoTime) add('warn', 'Automatic time is off', 'Wrong time can break security checks. Turn on automatic date and time.', null, 2);
    }
    const up = updateStatus(d);
    if (up.age != null) {
      const months = Math.round(up.age / 30);
      if (up.ended) add('risk', `${up.support.name}: updates ended about ${up.support.until}`, `This phone no longer gets security fixes (patch ${d.securityPatch}). Plan to replace it, and follow the protection checklist below until then.`, null, 30);
      else if (up.behind >= 12) add('risk', `Security patch is ${months} months old`, `Patch ${d.securityPatch}. About ${up.behind} monthly fixes are missing; ${up.support ? `your ${up.support.name} still gets updates until about ${up.support.until}` : 'a newer update is probably available'}. See “Software updates”.`, { to: 'update', label: 'Check for updates' }, 30);
      else if (up.behind >= 6) add('risk', `Security patch is ${months} months old`, `Patch ${d.securityPatch}. Install the latest system update.`, { to: 'update', label: 'Check for updates' }, 20);
      else if (up.behind >= 3) add('warn', `Security patch is ${months} months old`, `Patch ${d.securityPatch}. Check for a system update.`, { to: 'update', label: 'Check for updates' }, 10);
      else add('ok', 'Security patch is recent', `Patch ${d.securityPatch}.`);
    }
    if (d.sdk && d.sdk < 31) add('warn', `Android ${d.android} no longer gets updates`, 'Phones on Android 11 or older stop receiving security fixes.', null, 10);
    // Protection items are listed in their own card; only serious ones also go in the main findings.
    if (s) for (const p of protectFindings(s, d)) { if (p[0] === 'risk') add(...p); else score -= p[4] || 0; }
    const flagged = flagApps(apps);
    const high = flagged.filter((a) => a.level >= 2);
    if (high.length) add('risk', `${high.length} app${high.length === 1 ? '' : 's'} with powerful access to check`, `${high.map((a) => a.name).join(', ')}. See “Apps with powerful access” below.`, null, Math.min(30, high.length * 15));
    else if (flagged.length) add('warn', `${flagged.length} app${flagged.length === 1 ? '' : 's'} worth a look`, 'See “Apps with powerful access” below.', null, Math.min(10, flagged.length * 3));
    else if (apps) add('ok', 'No worrying apps found', `Checked ${apps.total} apps.`);
  }
  const up = d.uptimeMs;
  if (up != null) {
    if (up > 7 * DAY) add('warn', `Not restarted for ${ago(up)}`, 'Restart your phone now, then let GuardYourPhone remind you twice a day.', null, 10);
    else if (up > 2 * DAY) add('warn', `Not restarted for ${ago(up)}`, 'A restart clears anything hiding in memory.', null, 5);
    else add('ok', `Restarted ${ago(up)} ago`, 'Good. Keep restarting regularly.');
  }
  if (net?.cells?.some((c) => c.registered && c.gen === '2G') || net?.data === '2G') add('risk', 'Connected to a 2G network', '2G has weak encryption and fake towers use it to listen in. On Android 12 or newer, turn off “Allow 2G” in mobile network settings.', { to: 'network', label: 'Mobile network settings' }, 10);
  return { findings: f.sort((a, b) => ({ risk: 0, warn: 1, ok: 2 })[a.level] - ({ risk: 0, warn: 1, ok: 2 })[b.level]), score: Math.max(0, Math.round(score)) };
}

// ---------- software updates and the flashing alert ----------
function updateStatus(d) {
  const age = patchAge(d.securityPatch);
  const support = platform === 'android' || demo ? supportFor(d.model) : null;
  const exp = expectedPatch();
  const t = patchDate(d.securityPatch);
  const behind = t ? Math.max(0, (exp.getFullYear() - t.getFullYear()) * 12 + exp.getMonth() - t.getMonth()) : null;
  return { age, support, ended: !!support?.ended, expected: exp, behind, outdated: behind != null && behind >= 2 };
}
function renderUpdates(d) {
  const card = $('#update-card'), alert = $('#alert');
  if (platform === 'ios') { card.hidden = true; alert.hidden = true; return; }
  const u = updateStatus(d);
  card.hidden = false;
  $('#update-facts').replaceChildren(...[
    ['Your security patch', patchDate(d.securityPatch) ? monthName(patchDate(d.securityPatch)) : 'unknown'],
    ['Newest monthly patch', `${monthName(u.expected)} (if your maker has released it for your model)`],
    ['Months behind', u.behind == null ? '–' : String(u.behind)],
    ['Your phone', u.support ? u.support.name : `${cap(d.manufacturer)} ${d.model}`],
    ['Security updates until', u.support ? `about ${u.support.until}${u.ended ? ' (ended)' : ''}` : 'check the maker’s website'],
    ['System software', d.bootloader || '–'],
  ].flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]));
  $('#update-verdict').textContent = u.ended ? 'This phone no longer gets security fixes.' : u.outdated ? `Update needed: about ${u.behind} months of fixes are missing.` : 'Up to date. Keep automatic updates on.';
  $('#update-steps').replaceChildren(...(u.ended
    ? ['Plan to replace the phone with one that still gets updates (check how many years before you buy).', 'Until then: follow the protection checklist below, keep apps updated and avoid unknown links and files.']
    : howToUpdate(d.manufacturer)).map((x) => el('li', { text: x })));
  // Flashing alert at the top while the phone is out of date.
  alert.hidden = !(u.outdated || u.ended);
  if (!alert.hidden) alert.replaceChildren(
    el('strong', { text: u.ended ? '⚠️ NO MORE SECURITY UPDATES FOR THIS PHONE' : `⚠️ OUT OF DATE: ${u.behind} MONTHS OF SECURITY FIXES MISSING` }),
    el('p', { text: u.ended ? `${u.support.name} updates ended about ${u.support.until}. Known security holes will never be fixed on it.` : `Your patch is ${monthName(patchDate(d.securityPatch))}; the newest is ${monthName(u.expected)}. Spyware and hackers target the holes these updates fix.` }),
    el('button', { class: 'btn sm', type: 'button', text: u.ended ? 'What to do' : 'Update now', onclick: () => (u.ended ? $('#update-card').scrollIntoView({ behavior: 'smooth' }) : openSettings('update')) }));
}
$('#update-btn').addEventListener('click', () => openSettings('update'));

// ---------- protection against zero-click, man-in-the-middle and fake towers ----------
/** Things the phone itself reports: [level, title, text, fix, cost]. */
function protectFindings(s, d) {
  const out = [];
  if (s.userCaCerts?.length) out.push(['risk', `${s.userCaCerts.length} added security certificate${s.userCaCerts.length > 1 ? 's' : ''}`, `Whoever owns “${s.userCaCerts[0]}” can read your “secure” internet traffic (a man-in-the-middle). Unless your work or school installed it, remove it: Settings → Security → Other security settings → User certificates.`, { to: 'security', label: 'Security settings' }, 15]);
  if (s.httpProxy || s.systemProxy) out.push(['risk', 'Your internet goes through a proxy', `Traffic is being sent through ${s.httpProxy || s.systemProxy}. If you didn’t set this up, remove it in your Wi-Fi network’s settings (Proxy → None).`, { to: 'settings', label: 'Open Settings' }, 15]);
  if (s.onWifi && s.wifiSecurity === 0) out.push(['warn', 'Connected to open Wi-Fi (no password)', 'Others on this network may see or change what you do. Use mobile data or a trusted VPN here.', null, 5]);
  if (s.privateDnsMode === 'off') out.push(['warn', 'Private DNS is off', 'Turn it on so others can’t see or redirect the websites you visit: Settings → Connections → More connection settings → Private DNS → enter dns.google (Pixel: Network & internet → Private DNS).', { to: 'settings', label: 'Open Settings' }, 3]);
  else if (s.privateDnsMode === 'hostname') out.push(['ok', 'Private DNS is on', `Using ${s.privateDnsHost || 'your chosen provider'}.`]);
  if (s.advancedProtection === true) out.push(['ok', 'Advanced Protection is on', 'Android’s strongest protection against spyware and zero-click attacks.']);
  if (s.vpnActive) out.push(['ok', 'A VPN is on', 'Use a VPN you trust (a free unknown VPN can itself be a man-in-the-middle). Turn it off while checking for system updates.']);
  return out;
}

const CHECKS = [
  { group: 'Pictures, files and zero-click attacks', items: [
    { id: 'advprot', title: 'Turn on Advanced Protection (Android 16 or newer)', how: 'Settings → Security & privacy → Advanced Protection (Pixel), or search Settings for “Advanced Protection”. It blocks the riskiest ways spyware gets in.', auto: (s) => s?.advancedProtection === true },
    { id: 'autoblock', samsung: true, title: 'Samsung: Auto Blocker on, with Message Guard', how: 'Settings → Security and privacy → Auto Blocker → On. Turn on its message protection (Message Guard / “Block images in messaging apps” or “Maximum restrictions” where offered). It opens pictures from messages in a safe sandbox, the kind of attack LANDFALL used.', auto: (s) => s?.samsungAutoBlocker === true },
    { id: 'wa-media', title: 'WhatsApp: stop automatic downloads', how: 'WhatsApp → Settings → Storage and data → Media auto-download: set Mobile data, Wi-Fi and Roaming to “No media”. Pictures and files then only open when you tap them.' },
    { id: 'wa-privacy', title: 'WhatsApp: block unknown senders and hide your IP', how: 'WhatsApp → Settings → Privacy → Advanced: turn on “Block unknown account messages”, “Protect IP address in calls” and “Disable link previews”. Then Privacy → Calls → “Silence unknown callers”.' },
    { id: 'wa-2sv', title: 'WhatsApp: two-step verification PIN', how: 'WhatsApp → Settings → Account → Two-step verification. Stops someone taking over your WhatsApp with a stolen code.' },
    { id: 'mms', title: 'Messages: no automatic MMS downloads', how: 'Messages app → Settings → (Advanced / More settings) → turn off “Auto-download MMS” and “Auto-retrieve”.' },
    { id: 'playprotect', title: 'Google Play Protect is on', how: 'Play Store → your picture → Play Protect → Settings → “Scan apps with Play Protect” on.' },
  ] },
  { group: 'Snooping on your internet (man-in-the-middle)', items: [
    { id: 'privdns', title: 'Private DNS on', how: 'Settings → Connections → More connection settings → Private DNS → Private DNS provider hostname: dns.google (or one.one.one.one).', auto: (s) => s?.privateDnsMode === 'hostname' },
    { id: 'nocert', title: 'No unknown certificates or proxies', how: 'GuardYourPhone checks this for you. Never install a “certificate” or “profile” someone sends you.', auto: (s) => s && !s.userCaCerts?.length && !s.httpProxy && !s.systemProxy },
    { id: 'wifi', title: 'Careful on public Wi-Fi', how: 'Turn off auto-connect to open networks (Wi-Fi → ⋮ → Advanced). On public Wi-Fi use mobile data or a VPN you trust; never log in to banking there.' },
  ] },
  { group: 'Fake towers, SIM swaps and your IMSI / IMEI', items: [
    { id: '2g', title: 'Turn off 2G', how: 'Samsung: Settings → Connections → Mobile networks → turn off “Allow 2G service” (or set Network mode without 2G). Pixel: Network & internet → SIMs → “Allow 2G” off. Fake towers (IMSI catchers) force phones onto 2G to listen in.' },
    { id: 'cellsec', title: 'Turn on mobile network security alerts', how: 'Android 15/16: Settings → Security & privacy → More security & privacy → Mobile network security: turn on “Network notifications” (warns when a tower asks for your phone’s IMSI/IMEI) and “Require encryption” where offered. Not every phone has this yet.' },
    { id: 'simpin', title: 'SIM card PIN', how: 'Samsung: Settings → Security and privacy → More security settings → Set up SIM card lock. Stops a thief using your SIM (and your number) in another phone.' },
    { id: 'swap', title: 'Ask your carrier for SIM-swap protection', how: 'Call Flow or Digicel and ask for a PIN or password on your account before any SIM replacement or number transfer. SIM swaps are how criminals steal bank and WhatsApp codes.' },
    { id: 'imei', title: 'Keep IMEI, serial and EID private', how: 'Don’t post screenshots of Settings → About phone. These numbers can be used to clone or wrongly block a phone.' },
    { id: 'airplane', title: 'Airplane mode in sensitive places', how: 'In private meetings or when you suspect a fake tower, Airplane mode stops the modem (baseband) talking to any tower. Wi-Fi can be turned back on by itself.' },
  ] },
  { group: 'Every day', items: [
    { id: 'restart', title: 'Restart twice a day', how: 'GuardYourPhone reminds you at 5 am and 7 pm. Restarting clears spyware that lives only in memory.', auto: () => !!$('#remind')?.checked },
    { id: 'autoupd', title: 'Automatic updates on', how: 'Samsung: Settings → Software update → Auto download over Wi-Fi. Also keep Play Store auto-update apps on.' },
    { id: 'lock', title: 'Strong screen lock', how: 'A 6-digit PIN or longer, not a pattern. Samsung: add Lockdown to the power menu (Settings → Lock screen → Secure lock settings → Show Lockdown option).', auto: (s) => s?.screenLock === true },
  ] },
];
function renderProtect(s, d) {
  const card = $('#protect-card');
  card.hidden = platform === 'ios';
  if (card.hidden) return;
  $('#auto-checks').replaceChildren(...protectFindings(s || {}, d).map(([level, title, text, fix]) => el('li', { class: `finding ${level}` }, el('div', {}, el('strong', { text: title }), el('p', { text }),
    fix ? el('button', { class: 'btn sm', type: 'button', text: fix.label, onclick: () => openSettings(fix.to) }) : null))));
  const done = store.get('android-checks', {});
  const isSamsung = s?.isSamsung || /samsung/i.test(d?.manufacturer || '');
  let total = 0, ticked = 0;
  $('#protect-list').replaceChildren(...CHECKS.map((g) => el('div', { class: 'group' }, el('h3', { text: g.group }),
    ...g.items.filter((it) => !it.samsung || isSamsung).map((it) => {
      const auto = it.auto ? it.auto(s) : false;
      const on = auto || !!done[it.id];
      total++; if (on) ticked++;
      return el('label', { class: 'check-item' },
        el('input', { type: 'checkbox', checked: on ? '' : null, disabled: auto ? '' : null, onchange: (e) => { const x = store.get('android-checks', {}); x[it.id] = e.target.checked; store.set('android-checks', x); renderProtect(s, d); } }),
        el('span', {}, el('strong', { text: it.title + (auto ? ' ✓ (checked by GuardYourPhone)' : '') }), el('p', { text: it.how })));
    }))));
  $('#protect-progress').textContent = `${ticked} of ${total} protections in place`;
}

// ---------- iPhone checklist ----------
const IOS_CHECKS = [
  { id: 'update', text: 'iOS is up to date (Settings → General → Software Update), with Automatic Updates on.' },
  { id: 'passcode', text: 'A 6-digit (or longer) passcode and Face ID or Touch ID are set.' },
  { id: 'profiles', text: 'No profiles you don’t recognise under Settings → General → VPN & Device Management.' },
  { id: 'appleid', text: 'Only your own devices are listed under Settings → [your name] → Devices.' },
  { id: '2fa', text: 'Two-factor authentication is on for your Apple Account.' },
  { id: 'safety', text: 'Safety Check reviewed (Settings → Privacy & Security → Safety Check) to see who you share with.' },
  { id: 'lockdown', text: 'If you could be targeted (journalist, activist, official): Lockdown Mode is on (Settings → Privacy & Security).' },
];
function renderIos() {
  const done = store.get('ios-checks', {});
  $('#ios-card').hidden = platform !== 'ios';
  $('#ios-list').replaceChildren(...IOS_CHECKS.map((c) => el('li', {}, el('label', {},
    el('input', { type: 'checkbox', checked: done[c.id] ? '' : null, onchange: (e) => { const d = store.get('ios-checks', {}); d[c.id] = e.target.checked; store.set('ios-checks', d); } }), el('span', { text: c.text })))));
}

// ---------- drawing ----------
const openSettings = (to, pkg) => (demo ? toast('On your phone this opens Settings.') : Check?.openSettings({ to, package: pkg }));
let last = null, lastNet = null;
function render(data, net) {
  const { findings, score } = assess(data, net);
  const ring = $('#ring');
  ring.style.setProperty('--p', score);
  ring.style.setProperty('--c', score >= 80 ? 'var(--ok)' : score >= 55 ? 'var(--warn)' : 'var(--risk)');
  $('#score').textContent = String(score);
  $('#verdict').textContent = score >= 80 ? 'Looking good' : score >= 55 ? 'Some things to fix' : 'Needs attention';
  $('#checked').textContent = `Checked ${new Date().toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. ${(() => { const n = findings.filter((x) => x.level !== 'ok').length; return n ? `${n} ${n === 1 ? 'thing' : 'things'} to look at.` : 'Nothing to fix.'; })()}`;
  $('#findings').replaceChildren(...findings.map((x) => el('li', { class: `finding ${x.level}` }, el('div', {},
    el('strong', { text: x.title }), el('p', { text: x.text }),
    x.fix && platform !== 'ios' ? el('button', { class: 'btn sm', type: 'button', text: x.fix.label, onclick: () => openSettings(x.fix.to) }) : null))));

  const d = data.device;
  const facts = platform === 'ios'
    ? [['Phone', d.model], ['iOS', d.ios], ['Processor', 'Apple doesn’t share processor or modem details with apps']]
    : [['Phone', `${cap(d.manufacturer)} ${d.model}`], ['Android', `${d.android} (API ${d.sdk})`], ['Security patch', d.securityPatch],
      ['Application processor', [d.socManufacturer, d.socModel].filter(Boolean).join(' ') || d.hardware], ['Platform / board', [d.platform, d.board || d.hardware].filter(Boolean).join(' · ')],
      ['CPU cores', `${d.cores} · ${d.abis}`], ['Kernel', d.kernel],
      ['Baseband (modem) firmware', d.baseband || d.basebandProp || 'Not reported (no SIM, or Wi-Fi-only device)'], ['Bootloader', d.bootloader],
      ['Build', `${d.buildType || ''} · ${d.buildTags || ''}`], ['Last restart', d.uptimeMs != null ? `${ago(d.uptimeMs)} ago` : '–']];
  $('#chips').replaceChildren(...facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v || '–' })]));
  $('#chips-card').hidden = false;

  const flagged = flagApps(data.apps);
  $('#apps-card').hidden = platform === 'ios';
  $('#apps').replaceChildren(...(flagged.length ? flagged.map((a) => el('li', { class: 'app' },
    el('div', { class: 'name', text: a.name }), el('div', { class: 'muted small', text: a.package }),
    el('div', {}, el('span', { class: `tag ${a.level >= 2 ? 'risk' : 'warn'}`, text: a.level >= 2 ? 'Check this' : 'Worth a look' }), ...(a.permissions || []).map((p) => el('span', { class: 'tag', text: PERM_WORDS[p] || p }))),
    el('div', { class: 'why', text: `This app ${a.why.join('; ')}.` }),
    el('div', { class: 'row' }, el('button', { class: 'btn sm', type: 'button', text: 'App settings', onclick: () => openSettings('app', a.package) }),
      !a.system ? el('button', { class: 'btn sm', type: 'button', text: 'Uninstall', onclick: () => (demo ? toast('On your phone this asks Android to uninstall the app.') : Check.uninstall({ package: a.package }).catch((e) => toast(e.message))) }) : null)))
    : [el('li', { class: 'muted', text: data.apps ? `Nothing worrying among ${data.apps.total} apps.` : 'Couldn’t read the app list.' })]));
  $('#net-card').hidden = platform === 'ios';
  renderIos();
  renderUpdates(d);
  renderProtect(data.security, d);

  const lines = [`GuardYourPhone report · ${new Date().toLocaleString()}`, `Score: ${score}/100`, ...facts.map(([k, v]) => `${k}: ${v || '–'}`), '', 'Findings:', ...findings.map((x) => `[${x.level.toUpperCase()}] ${x.title}: ${x.text}`),
    ...(flagged.length ? ['', 'Apps to check:', ...flagged.map((a) => `- ${a.name} (${a.package}): ${a.why.join('; ')}`)] : []),
    ...(net ? ['', `Network: ${net.operator || '?'} · data ${net.data || '?'} · ${net.cells?.length || 0} towers seen`] : [])];
  $('#report').value = lines.join('\n');
  $('#uptime').textContent = d.uptimeMs != null ? `Last restart: ${ago(d.uptimeMs)} ago` : '';
}
const cap = (s) => String(s || '').replace(/^./, (c) => c.toUpperCase());

async function run() {
  const b = $('#run'); b.disabled = true; b.textContent = 'Checking…';
  try { last = await readAll(); render(last, lastNet); store.set('last-check', Date.now()); }
  catch (e) { toast(`Couldn’t finish the check: ${e.message || e}`); }
  finally { b.disabled = false; b.textContent = 'Check again'; }
}

async function checkNetwork() {
  const b = $('#net'); b.disabled = true;
  try {
    const n = demo ? EX.network : await Check.network();
    lastNet = n;
    const out = $('#network');
    if (n.noTelephony) { out.replaceChildren(el('p', { class: 'muted', text: 'This device has no mobile network.' })); return; }
    const two = n.cells?.some((c) => c.registered && c.gen === '2G') || n.data === '2G';
    out.replaceChildren(...[
      el('dl', { class: 'facts' }, ...[['Network', n.operator], ['SIM', n.simOperator], ['Data', n.data || 'unknown'], ['Calls', n.voice || 'unknown'], ['Roaming', n.roaming ? 'yes' : 'no']].flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v || '–' })])),
      !n.phonePermission || !n.locationPermission ? el('p', { class: 'muted small', text: 'Allow phone and location access to see the towers around you (Android requires location permission for this; nothing leaves your phone).' }) : null,
      n.cells?.length ? el('table', { class: 'cells' }, el('tr', {}, ['', 'Type', 'Tower', 'Area', 'Signal'].map((h) => el('th', { text: h }))),
        n.cells.map((c) => el('tr', {}, el('td', { text: c.registered ? '●' : '' }), el('td', { text: c.gen }), el('td', { text: String(c.cell ?? '') }), el('td', { text: String(c.area ?? '') }), el('td', { text: c.dbm ? `${c.dbm} dBm` : '' })))) : null,
      el('p', { class: 'muted small', text: two ? '⚠️ Your phone is on 2G. Turn off “Allow 2G” in mobile network settings (Android 12+), and be careful with calls and texts here.'
        : '● = the tower your phone is using. GuardYourPhone can’t prove a tower is genuine, but being pushed onto 2G in a place with good 4G is a warning sign.' }),
      el('button', { class: 'btn sm', type: 'button', text: 'Mobile network settings', onclick: () => openSettings('network') })].filter(Boolean));
    if (last) render(last, lastNet);
  } catch (e) { toast(`Couldn’t read the network: ${e.message || e}`); } finally { b.disabled = false; }
}

// ---------- restart reminders (5 am and 7 pm, every day) ----------
const REMINDERS = [{ id: 500, hour: 5 }, { id: 1900, hour: 19 }];
async function setReminders(on) {
  const msg = $('#remind-msg');
  store.set('remind', on);
  if (demo) { msg.textContent = on ? 'On your phone, reminders will come at 5:00 am and 7:00 pm.' : 'Reminders off.'; return; }
  try {
    await Notes.cancel({ notifications: REMINDERS.map((r) => ({ id: r.id })) }).catch(() => {});
    if (!on) { msg.textContent = 'Reminders off.'; return; }
    const perm = await Notes.requestPermissions();
    if (perm.display !== 'granted') { $('#remind').checked = false; store.set('remind', false); msg.textContent = 'Notifications are blocked for GuardYourPhone. Allow them in Settings to get reminders.'; return; }
    await Notes.schedule({ notifications: REMINDERS.map((r) => ({
      id: r.id, title: 'Time to restart your phone 🔄',
      body: 'Restart now to clear anything hiding in memory: hold the power button and tap Restart.',
      schedule: { on: { hour: r.hour, minute: 0 }, allowWhileIdle: true },
    })) });
    msg.textContent = 'Reminders set for 5:00 am and 7:00 pm every day.';
  } catch (e) { msg.textContent = `Couldn’t set reminders: ${e.message || e}`; }
}

$('#run').addEventListener('click', run);
$('#net').addEventListener('click', checkNetwork);
$('#remind').addEventListener('change', (e) => { setReminders(e.target.checked); if (last) render(last, lastNet); });
$('#copy').addEventListener('click', async () => {
  const t = $('#report');
  if (!t.value) return toast('Run a check first.');
  t.hidden = false;
  try { await navigator.clipboard.writeText(t.value); toast('Report copied. Paste it into a message.'); }
  catch { t.select(); toast('Select the text and copy it.'); }
});

// First open: reminders on by default; then run a check straight away.
const want = store.get('remind', true);
$('#remind').checked = want;
setReminders(want);
renderIos();
run();
