# Baseline and third-party code disclosure

The NEAR HACKATHON judges only work done after 2026-10-19, and code from before that must be disclosed. SpotAgents was started on 2026-11-14. Everything below is reused, third-party code and is **not** our own work.

## Upstream: Air Agents / Spatial-Agents (MIT)
- Repo: https://github.com/ahmedfahim21/Spatial-Agents (snapshot commit `00d2fce0bd1b9fd677844f69de099989e8331c06`, 2026-11-07). Licence: MIT, © 2026 AbhishekSatpathy4848.
- The original product is an iOS app with AirPods spatial audio, 0G inference and Hedera x402 payments.

| Upstream file | Used in | Change |
|---|---|---|
| `supabase/migrations/20261106000000_agents.sql`, `…120000_agent_shape.sql` | `supabase/migrations/0001_agents.sql` | Trimmed columns, added avatar, premium_context, price_yocto, creator_account |
| `supabase/functions/_shared/common.ts` | same path | Unchanged *(update if changed)* |
| `supabase/functions/chat/index.ts`, `routing.ts` | `supabase/functions/chat/` | 0G replaced by NEAR AI (`reasoning_effort:"low"`); tools and orders removed; premium gating added; `systemPrompt` moved to `prompt.ts`, `routing.ts` reduced to `modelFor`+request body (routing_test.ts not copied) |
| `supabase/config.toml` | same path | Project id |

Not used: the iOS and macOS apps, Hedera, x402, World ID, ElevenLabs TTS/STT, shop and merchant functions.

## Other open source
| Package or asset | Licence | Use |
|---|---|---|
| `@google/model-viewer` | Apache-2.0 | AR avatar Later removed (AR mode dropped). |
| `@hot-labs/near-connect` 0.12.0 + `near-api-js` | MIT / MIT | Wallet connect and signing |
| `near-sdk-rs` | MIT/Apache-2.0 | Contract |
| Avatar GLBs `apps/web/public/avatars/mage.glb`, `knight.glb` (Mage.glb, Knight.glb) | CC0 1.0 (confirmed in LICENSE.txt of the repo) | 3D avatars. Source: KayKit Adventurers Character Pack 1.0 by Kay Lousberg, https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (Characters/gltf/). Unmodified. Credit optional. Later removed; not in the submitted repo. |

## Our own work (judged)
The `spot_pay` contract, the quote and verify functions, premium gating, the NEAR AI integration, the whole web app (AR view, chat, voice, paywall), seed agents and the demo.


## ar-avatar (web UI, virtual visit)
Virtual visit photos (ADR-010), all from Wikimedia Commons with CC0 or CC BY-SA licences. Attribution is shown in the app (About) and listed in `apps/web/public/visit/CREDITS.json`. CC BY-SA images are shared under the same licence.

| File | Original | Source | Change |
|---|---|---|---|
| `apps/web/public/visit/01-approach.jpg` | Shanwar Wada Delhi darwaza.jpg by Jonathansammy, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Shanwar_Wada_Delhi_darwaza.jpg | Wikimedia Commons | Resized to ~1280 px wide by Commons (thumburl); unmodified otherwise |
| `apps/web/public/visit/02-delhi-darwaza.jpg` | Shaniwarwada dilli darwaza (close view).JPG by Nitish kharat, CC BY-SA 3.0, https://commons.wikimedia.org/wiki/File:Shaniwarwada_dilli_darwaza_(close_view).JPG | Wikimedia Commons | Resized to ~1280 px wide by Commons (thumburl); unmodified otherwise |
| `apps/web/public/visit/03-nagarkhana.jpg` | Nagarkhana, Shaniwar Wada, Pune.jpg by Jatin.mittal06, CC BY-SA 3.0, https://commons.wikimedia.org/wiki/File:Nagarkhana,_Shaniwar_Wada,_Pune.jpg | Wikimedia Commons | Resized to ~1280 px wide by Commons (thumburl); unmodified otherwise |
| `apps/web/public/visit/04-courtyard.jpg` | Courtyard of Shaniwarwada.jpg by Varada Phadkay, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Courtyard_of_Shaniwarwada.jpg | Wikimedia Commons | Resized to ~1280 px wide by Commons (thumburl); unmodified otherwise |
| `apps/web/public/visit/05-ruins.jpg` | Ruins of Shaniwar Wada 0.jpg by Pravega, CC0, https://commons.wikimedia.org/wiki/File:Ruins_of_Shaniwar_Wada_0.jpg | Wikimedia Commons | Resized to ~1280 px wide by Commons (thumburl); unmodified otherwise |
| `apps/web/public/visit/06-fountain.jpg` | Fountain near Shaniwar Wada, Pune.jpg by Vis M, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Fountain_near_Shaniwar_Wada,_Pune.jpg | Wikimedia Commons | Resized to ~1280 px wide by Commons (thumburl); unmodified otherwise |
## V2 realistic avatar (builder-web)
| Package or asset | Licence | Use |
|---|---|---|
| `@met4citizen/talkinghead` 1.8.2 (Mika Suominen) | MIT (package.json + LICENSE in npm tarball) | Avatar rendering, lip-sync, idle animation, gestures |
| `three` 0.186.0 | MIT | Peer dependency of TalkingHead |
| `apps/web/public/avatars/guide.glb` | CC0 1.0 | Realistic rigged human guide. Source: `avatars/mpfb.glb` of https://github.com/met4citizen/TalkingHead, created with Blender + MPFB (MakeHuman ecosystem, CC0/CC-BY assets). Its README states: "The avatar is licensed under CC0". Modified by us: textures resized to 1024 px, converted to WebP, mesh meshopt-compressed with glTF-Transform (36.8 MB to 3.1 MB). Other TalkingHead sample avatars (brunette = CC BY-NC, avaturn/avatarsdk/vroid = non-commercial) were NOT used. Later removed; not in the submitted repo. |
| `apps/web/public/avatars/brunette.glb` (ADR-011) | CC BY-NC 4.0 (non-commercial; risk accepted by the human) | Guide avatar. Created at Ready Player Me (https://readyplayer.me/), distributed as `avatars/brunette.glb` in https://github.com/met4citizen/TalkingHead (licence: https://creativecommons.org/licenses/by-nc/4.0/). Unmodified (4.7 MB; not optimised so all blendshapes stay). Credit shown on the About screen. `guide.glb` stays in the repo, unused. |
| `@met4citizen/headtts` 1.3.0 (V6) | MIT | In-browser neural TTS with phoneme timestamps and Oculus visemes. Runs in a Web Worker (worker module and dictionaries loaded from jsDelivr, pinned 1.3.0; transformers.js 4.0.0 from jsDelivr). Installed with `--ignore-scripts` because its postinstall uses `mkdir -p`, which fails on Windows; the script is only needed for the Node server. |
| Kokoro-82M v1.0 ONNX (timestamped), voice `af_heart` (V6) | Apache-2.0 | Model `onnx-community/Kokoro-82M-v1.0-ONNX-timestamped` fetched from Hugging Face at runtime, dtype `q8` (`model_quantized.onnx`, ~92 MB; the default fp32 is 325 MB). Not bundled. |

## V5 UI redesign (builder-web)
| Package or asset | Licence | Use |
|---|---|---|
| `leaflet` 1.9.4 | BSD-2-Clause | Interactive map on Explore |
| `lucide-react` 1.73.0 | ISC | Line icons everywhere |
| `@types/leaflet` (dev) | MIT | Types |
| Map tiles: OpenStreetMap standard tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, (c) OpenStreetMap contributors (ODbL), attribution visible on the map and in Profile credits | ODbL | Basemap, toned to a light look with a CSS filter. CARTO Positron raster tiles were the plan, but on 2026-11-14 every `*.basemaps.cartocdn.com` raster tile returns an "API KEY REQUIRED" watermark image (ETag `wm-...`), so they are unusable without a key. CARTO is still credited in Profile. To switch back: change `TILES`/`ATTR` in `src/screens/MapView.tsx`. |
| `apps/web/public/avatars/guide-face.jpg` | Derived from a screenshot of the brunette.glb guide (CC BY-NC 4.0, ADR-011) | Static face thumbnail for map pins, cards, arrival, Agents |
| Inter (Google Fonts) | OFL | UI font, system sans fallback |
