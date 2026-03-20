/**
 * Transcodes PullTalk staging uploads (staging/{uid}/{jobId}/source.webm) and writes
 * pulltalk_videos/v/{id}.webm, then updates Firestore pulltalkTranscodeJobs/{jobId}.
 */
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const ffmpegStatic = require("ffmpeg-static");

if (!admin.apps.length) {
  admin.initializeApp();
}

const JOBS = "pulltalkTranscodeJobs";

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegStatic) {
      reject(new Error("ffmpeg-static binary not found"));
      return;
    }
    const proc = spawn(ffmpegStatic, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    proc.stderr.on("data", (d) => chunks.push(d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const stderr = Buffer.concat(chunks).toString("utf-8").slice(-800);
        reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
      }
    });
  });
}

exports.pulltalkProcessStagingUpload = onObjectFinalized(
  {
    memory: "2GiB",
    timeoutSeconds: 540,
    cpu: 2,
    concurrency: 1,
  },
  async (event) => {
    const filePath = event.data.name;
    const bucketName = event.data.bucket;
    const match = /^staging\/([^/]+)\/([^/]+)\/source\.webm$/.exec(filePath);
    if (!match) {
      return;
    }
    const uid = match[1];
    const jobId = match[2];

    const db = admin.firestore();
    const jobRef = db.collection(JOBS).doc(jobId);
    const snap = await jobRef.get();
    if (!snap.exists) {
      logger.warn("No Firestore job for staging file", { jobId, filePath });
      return;
    }
    const job = snap.data();
    if (job.uid !== uid) {
      logger.error("UID mismatch for transcode job", { jobId, uid, jobUid: job.uid });
      await jobRef.update({ status: "failed", error: "UID mismatch — upload was rejected." });
      return;
    }

    await jobRef.update({ status: "processing" }).catch(() => {});

    const edit = job.edit;
    if (!edit || typeof edit.trimStart !== "number") {
      await jobRef.update({ status: "failed", error: "Job is missing edit parameters." });
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pulltalk-"));
    const inPath = path.join(tmpDir, "in.webm");
    const outPath = path.join(tmpDir, "out.webm");

    try {
      const bucket = admin.storage().bucket(bucketName);
      await bucket.file(filePath).download({ destination: inPath });

      const inStat = fs.statSync(inPath);
      if (inStat.size < 32) {
        throw new Error("Downloaded source file is empty or corrupt.");
      }

      const trimLen = Math.max(
        0.1,
        Math.min(edit.trimEnd - edit.trimStart, edit.dur - edit.trimStart + 1e6),
      );

      const args = [
        "-y",
        "-ss", String(edit.trimStart),
        "-i", inPath,
        "-t", String(trimLen),
      ];

      const fullCrop =
        edit.cropX === 0
        && edit.cropY === 0
        && edit.cropW === edit.vNatW
        && edit.cropH === edit.vNatH;
      if (!fullCrop) {
        args.push("-vf", `crop=${edit.cropW}:${edit.cropH}:${edit.cropX}:${edit.cropY}`);
      }

      if (edit.noAudio) {
        args.push("-an");
      } else {
        args.push("-c:a", "libopus", "-b:a", "96k");
      }

      args.push(
        "-c:v", "libvpx",
        "-deadline", "realtime",
        "-cpu-used", "8",
        "-b:v", "3M",
        "-threads", "2",
        outPath,
      );

      await runFfmpeg(args);

      const outStat = fs.statSync(outPath);
      if (outStat.size < 32) {
        throw new Error("Transcoded output is empty — ffmpeg may have failed silently.");
      }

      const uniqueId = `${Date.now()}_${randomUUID().slice(0, 8)}`;
      const destPath = `pulltalk_videos/v/${uniqueId}.webm`;
      const token = randomUUID();

      await bucket.upload(outPath, {
        destination: destPath,
        metadata: {
          contentType: "video/webm",
          metadata: {
            firebaseStorageDownloadTokens: token,
            uploadedAt: new Date().toISOString(),
            owner: String(job.owner),
            repo: String(job.repo),
            prId: String(job.prId),
          },
        },
      });

      const encodedPath = encodeURIComponent(destPath);
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

      await jobRef.update({
        status: "ready",
        downloadUrl,
      });

      await bucket.file(filePath).delete().catch(() => {});
      logger.info("Transcode complete", { jobId, inSize: inStat.size, outSize: outStat.size });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Transcode failed", { jobId, msg });

      let userMsg = msg;
      if (/exited/.test(msg)) {
        userMsg = "Video processing failed on the server. The clip may be in an unsupported format. Try a shorter clip or use "Upload without edits".";
      } else if (/ENOMEM|memory/.test(msg)) {
        userMsg = "Server ran out of memory processing this clip. Try a shorter recording.";
      }

      await jobRef.update({
        status: "failed",
        error: userMsg,
      }).catch(() => {});
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);
