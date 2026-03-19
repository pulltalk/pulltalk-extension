# Recorder architecture

## Flow

1. **PR tab** → modal → `start-recording` → background opens **recorder tab**.
2. **Recorder** (`recorder.html`):
   - **Chrome tab** and **Region**: user picks the target tab **once** in the PR modal (`captureTargetTabId`). Video comes from **`chrome.tabCapture.getMediaStreamId`** + `getUserMedia` (tab source) — no post-hoc “which tab?” screen. Optional **region picker** (region mode). **Target-tab overlay** is injected on that known tab as a **slim** capsule (Stop, timer, short hint only) so the user can stop without focusing the recorder tab; **annotations** are drawn on the PullTalk recorder preview (compositor). Scroll-from-preview still relays to the captured tab.
   - **Window** / **Entire screen** / **PiP screen leg**: **`getDisplayMedia`** with the appropriate `displaySurface` hint. **No** target-tab overlay (no stable `tabId`). **Annotation tools** stay on the recorder tab compositor (same as tab capture).
   - **Camera-only**: camera `getUserMedia` as today.
   - Then: **compositor** (canvas + `captureStream`) → **Web Audio** (mic + tab/system audio where applicable, optional **push-to-talk**) → `MediaRecorder` (WebM).
3. **Stop** (PullTalk recorder tab capsule, or target-tab overlay when linked) → blob to **IndexedDB** → editor tab.
4. **Editor** (`editor.html`): optional **trim / crop / strip audio** via **ffmpeg.wasm** → **upload to Firebase** (same page; MV3 workers cannot run Firebase Storage uploads) → `notify-pr-tab-recording-url` → background tells PR tab to insert link.

## Recording capsule (recorder tab UI)

- **Draggable capsule** at the bottom of the recorder page (`recordingCapsule.ts`): Shadow DOM, z-index `2147483647`, black / neon green (`#19e619`) / red stop (`#FF4B4B`).
- **Main bar:** grip (drag only), live timer (`HH:MM:SS` when ≥1h), **Stop** (finalizes → editor), **Tools** toggle.
- **Tools row (collapsible):** pointer/pan, pen, highlighter, text, arrow, rect, clear, color picker (no zoom/ellipse/spot/ring in UI). Optional **`annotationTools: 'minimal'`** in code can hide this row for special modes; default is **full** for tab, region, window, and screen.
- **Captured-tab overlay** (`recordingTargetOverlay.js`): same capsule chrome but **`capsuleLayout: 'target-slim'`** — no Tools row; Stop + timer + hint only.
- **Grip click** (without drag): collapse to six-dot handle only; click again to restore. **H** hides/shows the capsule.
- Annotations are applied in the **compositor** on the recorder tab; the **PR tab** has no recording overlay (only Record + modal + toasts).

## Compositor

- Main source: shared tab/screen or **camera-only** (full frame).
- **Camera + screen**: display + **PiP** webcam.
- **Virtual background** (MediaPipe Selfie Segmentation): main (camera-only) or PiP only.
- **Zoom** (smooth), **spotlight**, **cursor ring**, **click pulses**, **annotations** (draw, highlighter strokes, text, arrows, rect, ellipse).
- **Region**: normalized crop rect after user drags on frozen picker UI.

## Session and Stop (MV3)

- **Session** is persisted in `chrome.storage.session` (`prTabId`, `recorderTabId`, payload) so the service worker can sleep during long recordings.
- If the **port** from the recorder tab to the service worker is gone, **Stop** sets `pulltalkStopForTab` in session storage; the recorder page **polls** and finalizes the same way as a normal stop.

## Stop / timer while focus is elsewhere

- Recording controls live on the **PullTalk recorder tab** (not on the GitHub PR page). To show Stop and elapsed time while working in another app (e.g. IDE), options include:
  - **Document Picture-in-Picture** from the recorder tab: open a small always-on-top window with Stop + timer (requires a user gesture and browser support).
  - **`chrome.windows.create` popup** to an extension page: dedicated control window (may not stay above other apps).
- Annotation tools stay on the **recorder tab** compositor; they cannot be injected into non-browser windows without a native helper.

See [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) for scope boundaries, PR vs editor responsibilities, and session rules.

## Assets

- `public/mediapipe/*` — wasm/models for virtual background (`chrome.runtime.getURL('mediapipe/...')`).
- `public/ffmpeg/*` — ffmpeg.wasm core for the editor.
