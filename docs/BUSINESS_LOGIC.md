# PullTalk — product / business logic (for reviewers)

## Two-step flow: record → editor → upload

Upload to Firebase happens **only after** the user confirms in the **editor** tab (“Upload to PR” or “Apply … & upload”). The PR page is **not** uploading while the user trims video.

The **editor** UI is PR-focused (trim, crop, optional mute, then WebM upload). It may take layout cues from common screen-recorder editors, but the product does **not** add parallel flows such as Google Drive save or generic “download MP4” export—see *What we intentionally do not ship* below.

**Why:** Large WebMs need optional ffmpeg processing. **Upload runs in the editor tab** (not the MV3 service worker), because Firebase Storage’s web SDK uses `XMLHttpRequest`, which service workers do not provide.

## Session = one PR tab + one extension tab

Upload metadata (`owner`, `repo`, `prId`) lives in the background session started from that PR. If the user **reloads the PR tab** before uploading from the editor, the session may be lost and the editor upload will **fail** (blob is deleted as orphaned). Users should keep the PR tab open until the link appears.

## “Edit cancelled” vs closing the tab

**Discard** in the editor notifies the PR tab (“Edit cancelled”). Closing the editor tab with the window **X** does **not** run that path; the draft blob may remain in IndexedDB until overwritten.

## What we intentionally do not ship

- **Privacy blur** on arbitrary page regions  
- **MP4 / GIF / Google Drive** (WebM + Firebase link only)

## Virtual background

Uses **person segmentation** + solid color (or similar), not “blur anything on screen.” Failures fall back to the normal camera feed.

## Region capture

“Region” is a **software crop** after the user picks a share target, not an OS-level region capture API.

## Auto-stop alarm

Implemented as an in-tab timer in the recorder page. If that tab is suspended for a long time, behavior depends on the browser; prefer conservative alarm lengths for critical demos.
