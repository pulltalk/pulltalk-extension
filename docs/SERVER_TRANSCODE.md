# Server-side transcode (reliable “Process & upload”)

In-browser **ffmpeg.wasm** cannot process every screen recording (resolution × file size × crop) within WebAssembly memory limits. When **server transcode** is enabled, large or heavy edits skip wasm: the extension uploads the **raw WebM** to **Firebase Storage**, a **Cloud Function** runs **ffmpeg**, and the editor receives the same style of **download URL** as a normal upload (PR comment insertion unchanged).

## Enable in the extension build

1. In `.env`, set:
   ```bash
   VITE_PULLTALK_SERVER_TRANSCODE=true
   ```
2. Rebuild: `npm run build`

Same **tab / window / screen** recordings all use this path automatically when [policy thresholds](../src/shared/constants.ts) say “server” (large blob, >1080p-class frame area with edits, or crop + moderately large blob).

## Firebase project setup

### Checklist (you are here)

| Step | What to do |
|------|------------|
| ✅ | **Anonymous Auth** — Authentication → Sign-in method → Anonymous → Enable |
| ✅ | **Firestore** — Create database (any region you prefer) |
| ⬜ | **Deploy Firestore security rules** from this repo (see below) — *required* or clients cannot create/read job docs correctly |
| ⬜ | **Storage rules** — Add the **`staging/{uid}/{jobId}/...`** block from [README](../README.md#firebase-storage-rules) and publish (Console) or `firebase deploy --only storage` if you use a rules file |
| ⬜ | **Cloud Functions** — `cd functions && npm install` then `firebase deploy --only functions` from repo root |
| ⬜ | **Extension** — `.env`: `VITE_PULLTALK_SERVER_TRANSCODE=true`, then `npm run build` and reload the extension |

1. **Authentication → Sign-in method → Anonymous** — enable. *(done)*
2. **Firestore** — create database. *(done)*  
   Then deploy rules from repo root (uses `firestore.rules`):
   ```bash
   firebase login
   firebase use <YOUR_PROJECT_ID>   # same as VITE_FIREBASE_PROJECT_ID
   firebase deploy --only firestore:rules
   ```
3. **Storage rules** — allow authenticated writes to staging (see README “Firebase Storage rules” → `match /staging/{uid}/{jobId}/{fileName}`). Use **`allow create`** (not `allow write`) for staging so the Rules playground **create** simulation doesn’t hit “`resource` is undefined” (there is no existing object on create).

   **Rules playground tips:** Simulation type **create**; path like `staging/<your-uid>/<jobId>/source.webm`; turn **Authenticated** on and set **Firebase UID** to match the first path segment after `staging/`; set request metadata **content type** `video/webm` and a **size** under 100MB (if the UI asks — otherwise `request.resource` is empty in the simulator).

## Deploy Cloud Functions

```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```

Function name: **`pulltalkProcessStagingUpload`**. It triggers on `staging/{uid}/{jobId}/source.webm`, reads `pulltalkTranscodeJobs/{jobId}`, transcodes with ffmpeg, writes `pulltalk_videos/v/{id}.webm`, updates the job with `downloadUrl`.

## Flow

1. Editor signs in **anonymously** and creates `pulltalkTranscodeJobs/{jobId}` (`pending`).
2. Editor uploads `staging/{uid}/{jobId}/source.webm`.
3. Function runs → `ready` + `downloadUrl` or `failed` + `error`.
4. Editor **listens** on the job doc until `ready`, then runs the same PR notify path as a direct upload.

## If server transcode is required but not configured

Users see an error pointing here or **“Upload without edits”** (no re-encode).
