# SpotAgents Anywhere site

Marketing/landing page (Vite + React 19 + Tailwind v4 + lucide-react).

```bash
npm install --legacy-peer-deps
npm run dev      # local dev
npm run build    # type-check + static build into dist/
```

Knobs in `src/App.tsx`: `DEMO_VIDEO_URL` (YouTube-nocookie embed URL; empty shows the placeholder) and `REPO_URL`.
Screenshots: put `explore|arrival|talk|session|settled|wallet.png` in `public/screens/` (a missing file shows a neutral frame; list in `src/Screens.tsx`).
Photos in `public/visit/` (credits in `CREDITS.json`); guide face is `public/guide-face.jpg`.
