# Mouse Scrollwheel Zoom QOL Plugin — Implementation Plan

## Goal
Add opt-in mouse scrollwheel camera zoom for the web client while preserving the project's existing plugin-toggle model and launcher separation. The feature must be disabled by default and, when enabled, must only take effect through launcher option 2 (Custom Server + Hiscores).

Launcher options 1 and 3 are vanilla paths. They must never activate this plugin or any other custom plugin behavior, even if the corresponding `.env` or process environment variable is set to `true`.

Proposed flag: `NODE_QOL_SCROLLWHEEL_ZOOM=false`.

## Architecture fit
The repository already treats browser/client QOL features as environment-gated optional code:

- `engine/src/util/Environment.ts` parses `NODE_QOL_*` values.
- `engine/src/web.ts` passes client-facing QOL flags into `engine/view/client.ejs` and exposes them from `/api/features`.
- `engine/view/client.ejs` uses `window.__customContent` plus conditional `Client.prototype`/browser-event hooks for client QOL behavior.
- `engine/launcher.ts` exposes plugin/QOL switches in launcher option 14 and writes the selected values to `engine/.env`.
- `start.bat` is the Windows launcher entry point and can document/provide an optional QOL environment override without replacing `.env` as the normal source of truth.

The scrollwheel feature should follow that path, but its effective runtime value must be constrained by launcher mode: option 2 may honor the configured plugin value; options 1 and 3 must force the plugin off before starting their vanilla server/client paths.

## Hard launcher-scope invariant

This feature must preserve the following rule throughout implementation and testing:

- **Option 1 — Start Server:** vanilla; force `NODE_QOL_SCROLLWHEEL_ZOOM=false` for the spawned server/client path.
- **Option 2 — Custom Server + Hiscores:** custom/plugin path; honor `NODE_QOL_SCROLLWHEEL_ZOOM` from launcher option 14, `.env`, or an explicit process/start.bat override.
- **Option 3 — Start Server + Hiscores:** vanilla; force `NODE_QOL_SCROLLWHEEL_ZOOM=false` for the spawned server/client path.

A user may leave `NODE_QOL_SCROLLWHEEL_ZOOM=true` in `.env`; choosing option 1 or 3 must still produce vanilla behavior. The launcher mode is the final authority over whether plugins are allowed to become active.

## Phase 1 — Identify and isolate the camera zoom hook

**Status: complete (2026-08-27).**

### Camera discovery

- The normal gameplay camera does **not** have a persistent authoritative `cameraDistance`/zoom field.
- `webclient/src/client/Client.ts` computes the normal camera's final distance in `gameDrawMain()` and passes it to `camFollow(...)` as `pitch * 3 + 600`.
- `camFollow(pitch, yaw, targetX, targetY, targetZ, distance)` is the authoritative consumer of that distance. It rotates the distance vector by pitch/yaw and writes the resulting `camX`, `camY`, and `camZ` camera position.
- `followCamera()` keeps the normal orbit pitch in the vanilla range `128..383`. With the existing `pitch * 3 + 600` formula, the ordinary vanilla distance range is therefore `984..1749`.
- Camera shake can raise the effective pitch before the distance is calculated. The zoom implementation must not rewrite the existing pitch, yaw, shake, or camera-position code.
- When `cinemaCam` is active, the normal `camFollow(...)` path is bypassed. Scrollwheel zoom must leave scripted/cinematic camera behavior untouched.
- The separate `distance` array populated during startup for `World.init(...)` uses a related projection formula but is scene/render setup, not interactive camera zoom state. It must not be modified by this plugin.

### Selected hook

Use a small, explicit scrollwheel-zoom state at the normal gameplay distance seam rather than trying to repurpose pitch or monkey-patch an obfuscated/minified camera method from `client.ejs`.

The Phase 3 implementation should:

1. Keep the vanilla base expression `pitch * 3 + 600` as the source of normal camera distance.
2. Add plugin-owned zoom state with a neutral/default value that produces no change.
3. Apply that state only on the normal non-`cinemaCam` path immediately before the `camFollow(...)` call.
4. Register a `wheel` listener only when the server-provided effective `scrollwheelZoom` flag is true, scoped to the game canvas/client area.
5. Normalize wheel magnitude to direction only: wheel up zooms in by one step; wheel down zooms out by one step.

This keeps keyboard/pointer pitch and yaw controls, middle-mouse rotation, compass reset, camera shake inputs, and touch controls on their existing code paths.

### Initial safe zoom envelope

Use these conservative initial values for implementation and Phase 5 verification:

- **Minimum camera distance:** `768`
- **Maximum camera distance:** `2048`
- **Wheel step:** `64`

Rationale:

- The ordinary vanilla range is `984..1749`, so `768..2048` extends both directions without making the first implementation dramatically more aggressive than the existing camera envelope.
- A `64`-unit step is deterministic and granular enough that a single wheel event cannot cause a large jump.
- The final user-adjusted distance must be clamped to the configured envelope so rapid wheel input cannot accumulate beyond the supported range.
- These are conservative engineering bounds, not claimed engine hard-limits; Phase 5 visual/build testing may tighten them if clipping, visibility, or scene artifacts appear.

### Disabled-state/no-op requirement

The disabled path must preserve vanilla behavior exactly:

- Do not install or consume a `wheel` handler when `scrollwheelZoom !== true`.
- Do not call `preventDefault()` for wheel events when disabled.
- Do not clamp or otherwise rewrite the existing `pitch * 3 + 600` camera distance when disabled.
- Do not alter `orbitCameraPitch`, `orbitCameraYaw`, `cameraPitchClamp`, `camX`, `camY`, `camZ`, camera shake state, compass behavior, middle-mouse rotation, or touch input.
- Page scrolling outside the canvas must remain normal even when the plugin is enabled; consume the event only when the enabled handler is actually applying game zoom.

### Exit criteria

- [x] Authoritative camera distance seam identified: `gameDrawMain()` → `camFollow(..., pitch * 3 + 600)`.
- [x] Vanilla ordinary distance envelope documented: `984..1749` from pitch `128..383`.
- [x] Initial plugin bounds selected: `768..2048`.
- [x] Deterministic wheel step selected: `64`.
- [x] Cinematic camera, startup `World.init(...)` projection setup, pointer/touch controls, and existing camera controls identified as out-of-scope for mutation.
- [x] Disabled behavior defined as a true no-op with no wheel-event consumption.

## Phase 2 — Add environment and server-to-client wiring

1. Add `NODE_QOL_SCROLLWHEEL_ZOOM` to `engine/src/util/Environment.ts` using `tryParseBoolean(..., false)`.
2. Add a commented default to `engine/.env.example` in the custom-content QOL block:
   - `# NODE_QOL_SCROLLWHEEL_ZOOM=false`
3. Pass the effective value from `engine/src/web.ts` into `engine/view/client.ejs`.
4. Add the effective value to `/api/features` so external clients/wrappers can mirror the same setting.
5. Add a `scrollwheelZoom` boolean to `window.__customContent` in the web-client template.
6. Ensure options 1 and 3 launch with an explicit environment override of `NODE_QOL_SCROLLWHEEL_ZOOM=false`, so the effective value reaching `web.ts`, `/api/features`, and the client template is false on vanilla paths regardless of `.env`.

### Exit criteria
- Option 2 with unset/false keeps the client unchanged.
- Option 2 with true reaches the browser client as true.
- Options 1 and 3 always reach the browser client as false.
- `/api/features` reports the effective runtime value rather than merely echoing the saved `.env` preference.

## Phase 3 — Implement the optional web-client plugin behavior

1. Register the wheel hook only when `scrollwheelZoom === true`.
2. Scope the handler to the game canvas/client interaction area.
3. Normalize `WheelEvent.deltaY` into a stable zoom direction and step.
4. Clamp the camera zoom/distance to the bounds established in Phase 1.
5. Call `preventDefault()` only while the plugin is enabled and the wheel event is being consumed for game zoom, so normal page scrolling remains available otherwise.
6. Keep the implementation independent from middle-mouse rotation and compass reset so each QOL flag can be enabled or disabled separately within option 2.
7. Do not add fallback logic that independently re-reads `.env`, query parameters, local storage, or another source in the browser; the server-provided effective flag must remain the single runtime gate.

### Exit criteria
- Wheel up/down produces predictable zoom in/out on option 2 when enabled.
- Rapid scrolling cannot exceed bounds or corrupt camera state.
- Disabling the flag removes all scrollwheel camera behavior.
- Options 1 and 3 cannot activate the hook even if `.env` contains `NODE_QOL_SCROLLWHEEL_ZOOM=true`.

## Phase 4 — Launcher, `.env`, and Windows `start.bat` QOL integration

1. Add a launcher option-14 entry in `engine/launcher.ts`, under `QOL (Quality of Life)`:
   - `['Mouse Scrollwheel Zoom', 'NODE_QOL_SCROLLWHEEL_ZOOM']`
2. Confirm launcher toggling writes the preference to `engine/.env` using the existing `patchEnv` flow.
3. Make option 2 honor the configured value when starting the custom server.
4. Make options 1 and 3 explicitly override `NODE_QOL_SCROLLWHEEL_ZOOM` to `false` when spawning their vanilla server paths. This override must win over both `.env` and any process variable inherited from `start.bat`.
5. Add a clearly marked, commented QOL override section near the top of `start.bat` for Windows users, for example:
   - `rem === Optional QOL overrides for launcher option 2 ===`
   - `rem set "NODE_QOL_SCROLLWHEEL_ZOOM=true"`
6. Document in the batch comments that these plugin overrides are consumed only by option 2; options 1 and 3 deliberately force plugin flags off to remain vanilla.
7. Keep `.env`/launcher option 14 as the normal saved preference source. `start.bat` is only a convenient process-level override for option 2, not a way to inject plugins into vanilla modes.

### Exit criteria
- Users can toggle the saved preference from launcher option 14.
- Users can toggle it manually in `engine/.env`.
- Windows users have an obvious optional `start.bat` QOL override path labeled as option-2-only.
- Option 2 honors the configured value.
- Options 1 and 3 remain vanilla with the plugin forcibly disabled regardless of saved or inherited settings.

## Phase 5 — Documentation and verification

1. Add the plugin to `wiki/plugins.html` with:
   - flag name;
   - default (`false`);
   - launcher option-14 instructions;
   - manual `.env` example;
   - explicit option-2-only scope;
   - scroll direction and zoom bounds.
2. Verify at minimum:
   - option 2 with flag unset;
   - option 2 with flag false;
   - option 2 with flag true through `.env`;
   - option 2 with flag true through launcher option 14;
   - option 2 with flag true through the optional Windows `start.bat` override;
   - option 1 while `.env` contains `NODE_QOL_SCROLLWHEEL_ZOOM=true` — must remain vanilla;
   - option 3 while `.env` contains `NODE_QOL_SCROLLWHEEL_ZOOM=true` — must remain vanilla;
   - option 1/3 while `start.bat` exports `NODE_QOL_SCROLLWHEEL_ZOOM=true` — must remain vanilla;
   - coexistence with `NODE_QOL_MIDDLE_MOUSE_ROTATION=true` on option 2;
   - coexistence with `NODE_QOL_COMPASS_RESET=true` on option 2;
   - browser page scrolling outside the canvas;
   - no regression to touch/mobile pointer behavior.
3. Run the existing webclient build and each launcher server path after implementation.

## Acceptance criteria

- [ ] Mouse wheel zoom is disabled by default.
- [ ] `NODE_QOL_SCROLLWHEEL_ZOOM=true` enables zoom in/out only when using launcher option 2.
- [ ] Launcher option 14 exposes the saved toggle under QOL.
- [ ] The setting is documented in `.env.example` and the plugin wiki as option-2-only.
- [ ] `/api/features` exposes the effective setting: true is possible on option 2; options 1 and 3 report false.
- [ ] `start.bat` contains a commented option-2-only QOL override example without forcing the feature on.
- [ ] Options 1 and 3 force the plugin off even if `.env` or inherited process environment says true.
- [ ] Zoom is bounded and stable under rapid wheel input.
- [ ] Existing mouse rotation, compass reset, touch input, and vanilla behavior remain unchanged when the plugin is disabled.
- [ ] No implementation change makes option 1 or option 3 plugin-aware beyond explicitly suppressing custom plugin flags to guarantee vanilla behavior.

## Non-goals for the first implementation

- Changing the default camera distance.
- Adding animated/smoothed zoom before basic bounded zoom is proven stable.
- Making the setting account-specific or persistent in browser local storage.
- Altering the Java client unless investigation shows the web-client hook cannot safely control the camera state.
- Enabling any custom plugin behavior in launcher option 1 or option 3.
