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
  device: { manufacturer: 'samsung', brand: 'samsung', model: 'SM-A546E', android: '14', sdk: 34, securityPatch: '2026-03-01', baseband: 'A546EXXS7CXK1', hardware: 's5e8835', platform: 'erd8835', socManufacturer: 'Samsung', socModel: 'S5E8835', bootloader: 'A546EXXS7CXK1', abis: 'arm64-v8a, armeabi-v7a, armeabi', cores: 8, kernel: '5.15.123', buildTags: 'release-keys', buildType: 'user', uptimeMs: 9.3 * DAY },
  security: { screenLock: true, encrypted: true, usbDebugging: true, developerOptions: true, autoTime: true, verifiedBoot: 'green', flashLocked: '1', vbmetaState: 'locked', warrantyBit: '0', testKeys: false, rootSigns: [], deviceAdmins: ['com.google.android.gms'], accessibility: 'com.fastcleaner.boost/.AccService', notificationListeners: '' },
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

const patchAge = (s) => { const t = Date.parse(s); return Number.isFinite(t) ? Math.floor((Date.now() - t) / DAY) : null; };
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
    const age = patchAge(d.securityPatch);
    if (age != null) {
      if (age > 365) add('risk', `Security patch is ${Math.round(age / 30)} months old`, `Patch level ${d.securityPatch}. Check for a system update. If none comes, the maker has stopped updating this phone and it’s time to plan a replacement.`, { to: 'update', label: 'Check for updates' }, 30);
      else if (age > 180) add('risk', `Security patch is ${Math.round(age / 30)} months old`, `Patch level ${d.securityPatch}. Install the latest system update.`, { to: 'update', label: 'Check for updates' }, 20);
      else if (age > 90) add('warn', `Security patch is ${Math.round(age / 30)} months old`, `Patch level ${d.securityPatch}. Check for a system update.`, { to: 'update', label: 'Check for updates' }, 10);
      else add('ok', 'Security patch is recent', `Patch level ${d.securityPatch}.`);
    }
    if (d.sdk && d.sdk < 31) add('warn', `Android ${d.android} no longer gets updates`, 'Phones on Android 11 or older stop receiving security fixes.', null, 10);
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
$('#remind').addEventListener('change', (e) => setReminders(e.target.checked));
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
