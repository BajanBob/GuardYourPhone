// Runs after `cap add android`: adds GuardYourPhone's native check plugin, its permissions and the version.
import fs from 'node:fs';
import path from 'node:path';
const pkgDir = 'android/app/src/main/java/bb/guardyourphone/app';
fs.mkdirSync(pkgDir, { recursive: true });
fs.copyFileSync('native/android/bb/guardyourphone/app/GuardCheckPlugin.java', path.join(pkgDir, 'GuardCheckPlugin.java'));
fs.writeFileSync(path.join(pkgDir, 'MainActivity.java'), `package bb.guardyourphone.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GuardCheckPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
const p = 'android/app/src/main/AndroidManifest.xml';
let m = fs.readFileSync(p, 'utf8');
// QUERY_ALL_PACKAGES: to list every installed app (GuardYourPhone is a security check, sideloaded, not on Google Play).
for (const perm of ['INTERNET', 'READ_PHONE_STATE', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'QUERY_ALL_PACKAGES', 'REQUEST_DELETE_PACKAGES', 'POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'ACCESS_WIFI_STATE', 'ACCESS_NETWORK_STATE', 'QUERY_ADVANCED_PROTECTION_MODE']) {
  if (!m.includes(`android.permission.${perm}"`)) m = m.replace('</manifest>', `    <uses-permission android:name="android.permission.${perm}" />\n</manifest>`);
}
m = m.replace('</manifest>', '    <uses-feature android:name="android.hardware.telephony" android:required="false" />\n    <uses-feature android:name="android.hardware.location" android:required="false" />\n</manifest>');
m = m.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
if (!m.includes('usesCleartextTraffic')) m = m.replace('<application', '<application android:usesCleartextTraffic="false"');
fs.writeFileSync(p, m);
const vars = 'android/variables.gradle';
if (fs.existsSync(vars)) {
  let v = fs.readFileSync(vars, 'utf8');
  v = v.replace(/(compileSdkVersion|targetSdkVersion)\s*=\s*(\d+)/g, (all, k, n) => `${k} = ${Math.max(Number(n), 36)}`);
  fs.writeFileSync(vars, v);
}
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [a, b, c] = version.split('.').map(Number);
const code = a * 10000 + b * 100 + c;
const gradle = 'android/app/build.gradle';
let g = fs.readFileSync(gradle, 'utf8');
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
fs.writeFileSync(gradle, g);
console.log(`Android project patched for GuardYourPhone (version ${version}, code ${code})`);
