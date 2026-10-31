# GuardYourPhone

A phone security check-up for Android and iPhone, with restart reminders at **5:00 am and 7:00 pm** every day.

**On Android it checks:**
- The application processor (chip maker and model, platform, cores, kernel) and the baseband (modem) firmware version, bootloader and build.
- How old the security patch is, and whether this Android version still gets updates.
- Screen lock, encryption, verified boot and bootloader lock, signs of rooting, test-keys builds, USB debugging and developer options.
- Apps with powerful access: accessibility, device admin, notification access, apps installed from a file, and apps that can read texts or use the microphone. Each has an *App settings* button and an *Uninstall* button.
- The mobile network: the operator, whether the phone is on 2G, 3G, 4G or 5G, and the cell towers it can see. It warns when the phone is on 2G, which fake towers often force.
- It works all this into a score out of 100, with a button for each problem that opens the right Settings screen, and a report you can copy.

**On iPhone:** Apple lets apps see only the model and iOS version. GuardYourPhone shows those, gives the restart reminders and a guided security checklist.

**What it can't do:** no app on an ordinary phone can restart the phone by itself, look inside the baseband chip, or prove a phone is free of spyware. That's why it gives restart reminders rather than restarting the phone. GuardYourPhone reads only and sends nothing anywhere.

## Builds
Every push to `main` builds the app (`.github/workflows/build.yml`) and publishes a GitHub Release `v<version>` with:
- `GuardYourPhone.apk` for Android.
- `GuardYourPhone-iPhone-unsigned.ipa`, which must be signed with an Apple Developer account before it can be installed.

To sign the APK with your permanent key, add these repository secrets (Settings → Secrets and variables → Actions):
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

You can use the same values as for Spot. Without them, each build is signed with a temporary key, and an update won't install over an earlier version.

Raise `version` in `package.json` for each new release.

## Preview in a browser
Serve the `www/` folder (for example `npx serve www`). It shows example results.
