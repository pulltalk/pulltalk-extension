import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { PULLTALK_TRANSCODE_JOBS_COLLECTION } from "@/shared/constants";

/** Edit payload stored on the job doc (mirrors editor state fields needed by ffmpeg). */
export type TranscodeEditPayload = {
  trimStart: number;
  trimEnd: number;
  dur: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  vNatW: number;
  vNatH: number;
  noAudio: boolean;
};

export type TranscodeJobDoc = {
  uid: string;
  status: "pending" | "processing" | "ready" | "failed";
  owner: string;
  repo: string;
  prId: string;
  edit: TranscodeEditPayload;
  createdAt: unknown;
  downloadUrl?: string;
  error?: string;
};

export async function createTranscodeJobDocument(
  db: Firestore,
  jobId: string,
  uid: string,
  pr: { owner: string; repo: string; prId: string },
  edit: TranscodeEditPayload,
): Promise<void> {
  const ref = doc(db, PULLTALK_TRANSCODE_JOBS_COLLECTION, jobId);
  await setDoc(ref, {
    uid,
    status: "pending",
    owner: pr.owner,
    repo: pr.repo,
    prId: pr.prId,
    edit,
    createdAt: serverTimestamp(),
  });
}

export function waitForTranscodeJob(
  db: Firestore,
  jobId: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ref = doc(db, PULLTALK_TRANSCODE_JOBS_COLLECTION, jobId);
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      reject(new Error("Server processing timed out. Try again or use Upload without edits."));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists() || done) return;
        const data = snap.data() as TranscodeJobDoc;
        if (data.status === "ready" && data.downloadUrl) {
          done = true;
          window.clearTimeout(timer);
          unsub();
          resolve(data.downloadUrl);
        } else if (data.status === "failed") {
          done = true;
          window.clearTimeout(timer);
          unsub();
          reject(new Error(data.error || "Server transcoding failed."));
        }
      },
      (err) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        unsub();
        reject(err);
      },
    );
  });
}

export function buildStagingSourcePath(uid: string, jobId: string): string {
  return `staging/${uid}/${jobId}/source.webm`;
}
