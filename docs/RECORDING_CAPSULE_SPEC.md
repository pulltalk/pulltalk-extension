# Recording capsule spec

Specification for the **recorder-tab** overlay capsule (not the GitHub PR content script).

## Context

| Area | Responsibility |
|------|----------------|
| **Recorder tab** (`recorder.html` → `runRecorderFlow`) | Full-screen compositor canvas + **draggable capsule** for timer, stop, and **live annotation tools** (draw, highlight, text, arrow, rect, clear). |
| **Captured tab** (injected `recordingTargetOverlay.js`) | **Slim** capsule: timer, Stop, hint only (`capsuleLayout: 'target-slim'`). No drawing here — marks belong on the recorder compositor. |
| **PR tab** (`content` script on `github.com`) | Record button, modal, toasts only. No in-page timer or stop—everything else on the PullTalk recorder tab. |

Annotations must run on the **recorder tab compositor** because they paint into the pipeline that feeds `MediaRecorder`. A separate draw layer on the captured tab would duplicate UX and could diverge from what is encoded unless kept in sync.

## UI (annotation-focused)

- **Theme:** `#000000` surfaces, `#19E619` accents, `#FFFFFF` secondary icons/text, stop `#FF4B4B`.
- **Main capsule:** pill, border + shadow; **grip** (dots) left — **click** (no drag) collapses to **dots-only**; click again restores timer, Stop, and Tools. **Drag** grip (past ~10px) moves the bar.
- **Timer:** elapsed since record start; updates every second (`MM:SS`, or `HH:MM:SS` when needed).
- **Stop:** ends recording, persists blob, navigates to editor (recorder tab / target overlay only; not on GitHub PR page).
- **Tools (collapsible):** pointer (pan), pen, highlighter, text, arrow, rectangle, clear-all (eraser-style icon), color picker. Zoom, ellipse, spotlight, and cursor ring removed from UI; capture stays 1× with ring/spotlight off.

## Technical

- **Shadow DOM** on a fixed host so recorder page styles never leak in or out.
- **Viewport-clamped** drag (pointer events on grip; click vs drag threshold).
- **`z-index: 2147483647`** on the host.
- **Accessibility:** `aria-label` on all icon controls; toolbar `role="toolbar"` where appropriate.
- **State:** tools expanded/collapsed; main bar minimized to grip only; active tool synced with compositor pointer handlers.

## Files

- `src/recorder/recordingCapsule.ts` — mount/teardown, styles, icons (SVG).
- `src/recorder/recorderApp.ts` — wires capsule to `LiveCompositor` and `RecordSession` stop.
- `src/recorder/main.ts` — passes `requestStopRecording` into `runRecorderFlow`.
