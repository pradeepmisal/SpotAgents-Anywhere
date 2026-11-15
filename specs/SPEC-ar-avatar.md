# SPEC: ar-avatar

Status: Approved (2026-11-14) · Owner: builder-web · Contracts: `types.ts`, `api.md` §1 · ADR-008

## Objective
A phone-first web app that lists nearby agents and shows the selected agent's 3D avatar in AR on the ground.

## Scope
- `apps/web`: Vite + React + TS app. Screens:
  - **Nearby:** list sorted by distance, with name, emoji, distance and a "Paid · 0.1 NEAR" badge.
  - **Agent:** the AR view with the chat panel and the paywall slot.
  - **About:** baseline credits and model attribution.
- Supabase client and anonymous sign-in on load. Location from `navigator.geolocation.watchPosition`.
- `<model-viewer>` with `ar`, `ar-modes="webxr scene-viewer"`, `ar-placement="floor"` and `camera-controls`. Outside AR it shows an inline 3D preview. Start an idle animation if the GLB has one.
- Avatars in `public/avatars/*.glb`. Use 1 to 3 free-licence models, with sources and licences listed in `docs/BASELINE.md`.
- **Location switch** in the header: "My location" (GPS) or "Demo City" (`DEMO_CITY` from types). When Demo City is on, a visible badge reads "Simulated location". Judges outside Pune use this, and so does the video's city segment.
- Mock mode: `?mock=1` uses fixtures typed as `NearbyAgent[]`, so the UI can be built before the backend exists.
- Deploy target: Vercel (static). HTTPS is required for camera, mic and location.

## Out of scope
Maps, the compass/Find view, multiple anchored avatars in one AR session, iOS-specific work.

## Acceptance criteria
1. On Android Chrome over HTTPS, with location allowed, the Nearby list shows the seed agents in under 3 s.
2. Tapping an agent and then "View in AR" places the avatar on the floor at roughly real scale.
3. The chat panel stays usable in AR. If WebXR DOM overlay isn't available, it falls back to the inline 3D view with chat underneath. Write down which behaviour you saw.
4. Denying location shows a clear message and switches to Demo City in one tap. While it's on, the "Simulated location" badge is always visible.
5. No console errors, and no horizontal scroll at 360 px.

## [VERIFY] first (spike task)
- The current `@google/model-viewer` version, and whether it supports DOM overlay in its WebXR mode on Android Chrome.
- Whether Scene Viewer mode leaves the page, which would hide the chat.

## Verified facts (T05 spike, 2026-11-14)
- **model-viewer version:** `npm view @google/model-viewer version` returns `4.4.0` (dist-tag latest; modified 2026-10-09). Licence Apache-2.0. Pin `4.4.0`.
- **ar-modes:** accepted values are `quick-look`, `scene-viewer`, `webxr`, `none` (default `webxr scene-viewer quick-look`). Modes are tried in listed order; the first usable one is used. Verified in `lib/features/ar.js` of 4.4.0. `ar-placement` supports `floor` (default) and `wall`; `ar-scale="fixed"` stops pinch-resize.
- **WebXR DOM overlay: documented in source, NOT phone-tested.** `ARRenderer.js` requests `optionalFeatures: ['hit-test','dom-overlay','light-estimation']` with `domOverlay: { root }`, where root is the shadow-DOM `div.default`. That div holds the default (unnamed) slot, so light-DOM children of `<model-viewer>` with no `slot` attribute (our chat panel) should stay visible during WebXR AR on Android Chrome. Rules: the chat must be a direct unnamed child of `<model-viewer>`; the overlay root is fixed at session start; a named slot (e.g. `slot="ar-button"`) is not in the overlay; taps on overlay UI must not trigger hit-test (model-viewer handles `beforexrselect`). Needs a phone check (Phone test for T-later).
- **Scene Viewer:** model-viewer launches it via an Android `intent://arvr.google.com/scene-viewer/1.2?...;package=com.google.android.googlequicksearchbox;...;S.browser_fallback_url=<page url>`. It opens the Google app's Scene Viewer as a separate full-screen activity, so our page and chat are NOT visible during AR (only an optional `link=` button can return to the page). If the intent is blocked, model-viewer goes to the next ar-mode. Because `webxr` is listed first, Scene Viewer only applies when WebXR AR is unavailable (e.g. no ARCore/WebXR support). Fallback plan: keep `ar-modes="webxr scene-viewer"`; if the chat is required during AR and WebXR is unavailable, show inline 3D with chat underneath (omit `scene-viewer` or detect `navigator.xr` `isSessionSupported('immersive-ar')`). Scene Viewer behaviour above is from source and Google docs knowledge; not phone-tested.
- **Avatar candidates (do not download yet; confirm licence on the download page at T07):**
  1. Quaternius Universal Base Characters, https://quaternius.com/packs/universalbasecharacters.html, CC0, glTF available; animation clips not confirmed (pairs with Universal Animation Library).
  2. Kenney animated character packs (Protagonists / Survivors), https://kenney.nl/assets, CC0, GLB/glTF; exact pack page URL [VERIFY].
  3. KayKit Character Pack: Adventurers (Kay Lousberg), https://kaylousberg.itch.io/kaykit-adventurers, CC0 per secondary source, glTF/FBX; [VERIFY] on the page. Quaternius Ultimate Animated Character Pack is reported under a different Quaternius licence, so avoid without checking.
  Licences for 2 and 3 come from secondary summaries; confirm before listing in `docs/BASELINE.md`.
