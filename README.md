# PullTalk Extension

Clarify code reviews in 60 seconds — add voice, video, and visual context directly to GitHub pull requests.

## Features

- **Capture:** Chrome tab, window, entire screen, **region** (crop after share), **camera only**, or **screen + camera (PiP)**
- **Audio:** mic + tab/system audio; optional **push-to-talk** (hold Space)
- **On-screen:** zoom, spotlight, cursor ring, click pulses, **draw / text / arrows / shapes**
- **AI virtual background** on camera (MediaPipe) with solid-color fill
- **Recorder UX:** draggable toolbar, hide UI (**H**), optional auto-stop timer
- **Editor** (after stop): trim, crop (%), strip audio → **WebM** → Firebase upload → short blockquote + reference link in the PR comment
- `npm install` copies **MediaPipe** + **ffmpeg.wasm** assets into `public/` for the packaged extension

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome/Edge (MV3 service worker + module)
- Firebase project with Storage enabled

### Installation

1. Clone and install:
   ```bash
   git clone https://github.com/pulltalk/pulltalk-extension.git
   cd pulltalk-extension
   npm install
   ```

2. **Configure Firebase:** copy `.env.example` to `.env` and set `VITE_FIREBASE_*` (used at build time for the service worker).

3. **Build:** `npm run build`

4. **Load in Chrome:** `chrome://extensions/` → Developer mode → Load unpacked → select `dist/`

## Development

```bash
npm run dev    # watch + reload extension
npm run build  # typecheck + production build
npm run lint
npm run type-check
```

## Project structure

```
src/
  content/       # PR page UI: modal, Record button, toasts, messaging
  background/    # Orchestration, upload, IndexedDB read after record
  recorder/      # Compositor, capture, audio graph, recorder UI
  editor/        # Post-record trim/crop (ffmpeg.wasm) → upload
  github/        # PR/repo helpers, comment DOM, markdown insert
  storage/       # Firebase (lazy-safe), upload, storage paths
  shared/        # Message types, IndexedDB helpers
docs/
  BUSINESS_LOGIC.md          # Product scope and session rules
  RECORDER_ARCHITECTURE.md   # Capture flow, compositor, MV3 session
  RECORDING_CAPSULE_SPEC.md  # Recorder overlay UI spec
```

## How it works

1. Content script injects **Record** on PR comment areas (MutationObserver for GitHub SPA).
2. Modal → **Start** → background opens the recorder tab and signals capture via a **connected port**.
3. **Stop** in the PullTalk recorder tab → blob in IndexedDB → **editor** tab → upload → background → `recording-url` → markdown inserted.

See [docs/RECORDER_ARCHITECTURE.md](docs/RECORDER_ARCHITECTURE.md) for capture flow, compositor, and blob handoff details.

## Firebase Storage rules

Videos are stored as `pulltalk_videos/v/{timestamp}_{id}.webm` (short URLs). Example rules:

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pulltalk_videos/v/{videoId} {
      allow read: if true;
      allow write: if request.resource.size < 100 * 1024 * 1024
                      && request.resource.contentType.matches('video/.*');
    }
    // Legacy nested paths (older uploads)
    match /pulltalk_videos/{owner}/{repo}/{allPaths=**} {
      allow read: if true;
      allow write: if request.resource.size < 100 * 1024 * 1024
                      && request.resource.contentType.matches('video/.*');
    }
  }
}
```

Tighten `write` for production (e.g. auth). You can drop the legacy `match` if you never used the old path layout.

## Troubleshooting

- **Recorder tab / permissions:** Approve screen + mic when prompted; keep the PR tab open until upload finishes.
- **Upload fails:** Check Storage rules, `VITE_FIREBASE_*` in `.env`, and the service worker console (`chrome://extensions` → service worker “Inspect”).
- **Button missing:** Must be on a PR URL matching `github.com/*/*/pull/*`.

## License

MIT — see [LICENSE](./LICENSE).
