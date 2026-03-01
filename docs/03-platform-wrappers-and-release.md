# Platform Wrappers and Release

## Target Platforms
- Web browser (primary runtime).
- Steam desktop client via Electron.
- Android client via Capacitor.

## Steam Wrapper (Electron)
### Responsibilities
- Load packaged web app.
- Handle desktop windowing, updates, and crash reporting bridge.
- Integrate Steam platform identity for login handoff.

### Packaging
- Build web assets once.
- Bundle into Electron app package.
- Publish through Steam branches: `internal`, `beta`, `stable`.

### Runtime Constraints
- Enforce secure content loading only from trusted app bundle/CDN domains.
- Detect offline state and show reconnect/retry UX.

## Android Wrapper (Capacitor)
### Responsibilities
- Host web app in native shell.
- Integrate Android lifecycle hooks (pause/resume/background).
- Provide notification hooks for timed jobs/shop refresh reminders.

### Packaging
- Build web assets once.
- Sync assets into Capacitor Android project.
- Release tracks: `internal`, `closed testing`, `production`.

### Runtime Constraints
- App must recover gracefully after backgrounding during active combat timer sync.
- Network transition (Wi-Fi <-> mobile) must trigger realtime reconnect logic.

## Shared Wrapper Requirements
- Single source frontend build.
- Feature flags to disable platform-specific integrations when unavailable.
- Consistent analytics identity across web/Steam/Android where account is linked.

## Release Workflow
1. Merge release candidate branch.
2. Build/version web artifact.
3. Run smoke tests for browser + Steam + Android.
4. Publish to internal tracks.
5. Validate telemetry/error rates.
6. Promote to stable tracks.

## Compliance Checklist (High-Level)
- Store age rating metadata.
- Privacy policy and data collection disclosure.
- Purchase flow disclosures (if IAP enabled per platform).
- Crash reporting notice and consent handling where required.

