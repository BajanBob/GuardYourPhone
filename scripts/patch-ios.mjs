// Runs after `cap add ios`.
import fs from 'node:fs';
import plist from 'plist';
const p = 'ios/App/App/Info.plist';
const info = plist.parse(fs.readFileSync(p, 'utf8'));
info.ITSAppUsesNonExemptEncryption = false;
fs.writeFileSync(p, plist.build(info));
console.log('iOS project patched for GuardYourPhone (sign with your Apple Developer account to install)');
