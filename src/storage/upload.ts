import { getFirebaseStorage, isFirebaseConfigured } from "./firebase";

export { isFirebaseConfigured };
import { ref, uploadBytes, getDownloadURL, type UploadResult } from "firebase/storage";
import { buildVideoStoragePath } from "./paths";

import { MAX_VIDEO_SIZE_BYTES } from "@/shared/constants";

const MAX_SIZE = MAX_VIDEO_SIZE_BYTES;

export async function uploadVideoBlob(
  videoBlob: Blob,
  meta: { owner: string; repo: string; prId: string }
): Promise<string> {
  if (!videoBlob || videoBlob.size === 0) {
    throw new Error("Invalid video blob: empty or null");
  }
  if (videoBlob.size > MAX_SIZE) {
    throw new Error(
      `Video too large: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB (max 100MB)`
    );
  }
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const storage = getFirebaseStorage();
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const filename = buildVideoStoragePath(
    meta.owner,
    meta.repo,
    meta.prId,
    uniqueId
  );
  const storageRef = ref(storage, filename);

  const uploadResult: UploadResult = await uploadBytes(storageRef, videoBlob, {
    contentType: "video/webm",
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      prId: meta.prId,
      owner: meta.owner,
      repo: meta.repo,
      size: videoBlob.size.toString(),
    },
  });

  return getDownloadURL(uploadResult.ref);
}
