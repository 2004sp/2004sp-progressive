# Mouse Scrollwheel Zoom QOL Plugin — Implementation Plan

## Goal
Add opt-in mouse scrollwheel camera zoom for the web client while preserving the project's existing plugin-toggle model. The feature must be disabled by default and controlled by the same environment/launcher path used by current client QOL switches.

Proposed flag: `NODE_QOL_SCROLLWHEEL_ZOOM=false`.

## Architecture fit
The repository already treats browser/client QOL features as environment-gated optional code:

- `engine/src/util/Environment.ts` parses `NODE_QOL_*` values.
- `engine/src/web.ts` passes client-facing QOL flags into `engine/view/client.ejs` and exposes them from `/api/features`.
- `engine/view/client.ejs` uses `window.__customContent` plus conditional `Client.prototype`/browser-event hooks for client QOL behavior.
- `engine/launcher.ts` exposes plugin/QOL switches in launcher option 14 and writes the selected values to `engine/.env`.
- `start.bat` is the Windows launcher entry point and can document/provide an optional QOL environment override without replacing `.env` as the normal source of truth.

The scrollwheel feature should follow that path rather than introducing a separate configuration mechanism.

## Phase 1 — Identify and isolate the camera zoom hook

1. Locate the web client's authoritative camera-distance/zoom state and the render/update path that consumes it.
2. Confirm whether zoom should be implemented by:
   - a small `Client.prototype` patch, consistent with existing QOL hooks; or
   - a canvas `wheel` listener that updates the client camera field directly.
3. Define safe bounds and a deterministic wheel step so repeated wheel events cannot push the camera outside supported values.
4. Confirm the hook does not interfere with existing camera yaw/pitch controls, minimap/compass behavior, touch controls, text input, or browser scrolling when the plugin is disabled.

### Exit criteria
- Camera field/method is identified.
- Min/max zoom values and wheel step are documented in code comments or constants.
- Disabled state is a true no-op.

## Phase 2 — Add environment and server-to-client wiring

1. Add `NODE_QOL_SCROLLWHEEL_ZOOM` to `engine/src/util/Environment.ts` using `tryParseBoolean(..., false)`.
2. Add a commented default to `engine/.env.example` in the custom-content QOL block:
   - `# NODE_QOL_SCROLLWHEEL_ZOOM=false`
3. Pass the value from `engine/src/web.ts` into `engine/view/client.ejs`.
4. Add the value to `/api/features` so external clients/wrappers can mirror the same setting.
5. Add a `scrollwheelZoom` boolean to `window.__customContent` in the web-client template.

### Exit criteria
- Unset/false keeps the 2004-style client behavior unchanged.
- True reaches the browser client as a boolean.
- `/api/features` reports the same effective value.

## Phase 3 — Implement the optional web-client plugin behavior

1. Register the wheel hook only when `scrollwheelZoom === true`.
2. Scope the handler to the game canvas/client interaction area.
3. Normalize `WheelEvent.deltaY` into a stable zoom direction and step.
4. Clamp the camera zoom/distance to the bounds established in Phase 1.
5. Call `preventDefault()` only while the plugin is enabled and the wheel event is being consumed for game zoom, so normal page scrolling remains available otherwise.
6. Keep the implementation independent from middle-mouse rotation and compass reset so each QOL flag can be enabled or disabled separately.

### Exit criteria
- Wheel up/down produces predictable zoom in/out.
- Rapid scrolling cannot exceed bounds or corrupt camera state.
- Disabling the flag removes all scrollwheel camera behavior.

## Phase 4 — Launcher, `.env`, and Windows `start.bat` QOL integration

1. Add a launcher option-14 entry in `engine/launcher.ts`, under `QOL (Quality of Life)`:
   - `['Mouse Scrollwheel Zoom', 'NODE_QOL_SCROLLWHEEL_ZOOM']`
2. Confirm launcher toggling writes the setting to `engine/.env` using the existing `patchEnv` flow.
3. Add a clearly marked, commented QOL override section near the top of `start.bat` for Windows users, for example:
   - `rem === Optional QOL overrides ===`
   - `rem set "NODE_QOL_SCROLLWHEEL_ZOOM=true"`
4. Document precedence in the batch comments: an explicitly set process environment variable overrides `.env`; otherwise `.env`/the launcher remains the normal source of truth.
5. Do not make scrollwheel zoom option-2-only. It is a client QOL plugin like middle-mouse rotation/compass reset and should work wherever the configured web client is served.

### Exit criteria
- Users can toggle the feature from launcher option 14.
- Users can toggle it manually in `engine/.env`.
- Windows users have an obvious optional `start.bat` QOL override path.
- No duplicate configuration state is required.

## Phase 5 — Documentation and verification

1. Add the plugin to `wiki/plugins.html` with:
   - flag name;
   - default (`false`);
   - launcher option-14 instructions;
   - manual `.env` example;
   - scroll direction and zoom bounds.
2. Verify at minimum:
   - flag unset;
   - flag false;
   - flag true through `.env`;
   - flag true through launcher option 14;
   - flag true through the optional Windows `start.bat` override;
   - coexistence with `NODE_QOL_MIDDLE_MOUSE_ROTATION=true`;
   - coexistence with `NODE_QOL_COMPASS_RESET=true`;
   - browser page scrolling outside the canvas;
   - no regression to touch/mobile pointer behavior.
3. Run the existing webclient build and server startup path after implementation.

## Acceptance criteria

- [ ] Mouse wheel zoom is disabled by default.
- [ ] `NODE_QOL_SCROLLWHEEL_ZOOM=true` enables zoom in/out in the browser client.
- [ ] The setting is available in launcher option 14 under QOL.
- [ ] The setting is documented in `.env.example` and the plugin wiki.
- [ ] `/api/features` exposes the effective setting.
- [ ] `start.bat` contains a commented QOL override example without forcing the feature on.
- [ ] Zoom is bounded and stable under rapid wheel input.
- [ ] Existing mouse rotation, compass reset, touch input, and vanilla behavior remain unchanged when the plugin is disabled.

## Non-goals for the first implementation

- Changing the default camera distance.
- Adding animated/smoothed zoom before basic bounded zoom is proven stable.
- Making the setting account-specific or persistent in browser local storage.
- Altering the Java client unless investigation shows the web-client hook cannot safely control the camera state.
