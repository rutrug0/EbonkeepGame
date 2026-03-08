# Android Testing

## Purpose
This document covers the current straight path for testing Ebonkeep on Android before a native Capacitor wrapper exists in the repo.

Today the practical Android workflow is:
- run the normal local API and web stack on your Windows machine
- access the web client from an Android emulator browser through `10.0.2.2`

## Current State
- The repo currently includes the web client, API, and desktop wrapper.
- A native Android wrapper is planned, but there is no Android project checked into the repo yet.
- For now, Android testing means browser-based testing in an emulator or on a physical device.

## Required Setup
Install Android Studio first.

Then install these SDK components from Android Studio `SDK Manager`:
- `Android SDK Platform-Tools`
- `Android Emulator`
- at least one Android platform SDK
- at least one system image for that platform

Then create an AVD from Android Studio `Device Manager`.

Default paths on Windows usually look like:
- SDK: `%LOCALAPPDATA%\Android\Sdk`
- AVDs: `%USERPROFILE%\.android\avd`

If you use a non-default SDK path, set one of:
- `ANDROID_SDK_ROOT`
- `ANDROID_HOME`

## Launching The Emulator
Use:

```bat
run-android-emulator.bat
```

To launch a specific AVD:

```bat
run-android-emulator.bat <AVD_NAME>
```

The script:
- finds the Android SDK
- launches the selected AVD
- waits for the emulator to finish booting

## Starting The App For Emulator Testing
Use:

```bat
run-local-android.bat
```

This starts the normal local stack, but launches the web dev server with emulator-safe frontend endpoints:
- `VITE_API_URL=http://10.0.2.2:4000`
- `VITE_WS_URL=ws://10.0.2.2:4000/ws`

The API still runs locally on your Windows machine, but the emulator accesses it through `10.0.2.2`.

## Emulator URLs
Inside the Android emulator, use:
- Web app: `http://10.0.2.2:5173`
- API: `http://10.0.2.2:4000`
- WebSocket: `ws://10.0.2.2:4000/ws`

Do not use `localhost` inside the emulator for services running on your PC. In the Android emulator, `localhost` points to the emulator itself, not your Windows host.

## Recommended Workflow
1. Install Android Studio SDK and create an AVD.
2. Run `run-android-emulator.bat`.
3. Run `run-local-android.bat`.
4. Open Chrome inside the emulator.
5. Browse to `http://10.0.2.2:5173`.

## Real Device Testing
If you want to test on a physical Android device on the same Wi-Fi network, use your PC's LAN IP instead of `10.0.2.2`.

That means the frontend should point to:
- `http://<your-pc-lan-ip>:4000`
- `ws://<your-pc-lan-ip>:4000/ws`

`run-local-android.bat` is specifically for the Android emulator, not for real-device LAN testing.

## Current Caveats
- This is browser-based Android testing, not a packaged Android app build.
- Some frontend code still contains hardcoded `localhost` calls outside the main API helper path. Those flows may still need cleanup before all emulator flows work correctly.
- There is no Capacitor Android project in the repo yet.
