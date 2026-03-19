import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function copyDirFlat(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const f of readdirSync(srcDir)) {
    if (
      f.endsWith(".js") ||
      f.endsWith(".wasm") ||
      f.endsWith(".tflite") ||
      f.endsWith(".binarypb") ||
      f.endsWith(".data")
    ) {
      copyFileSync(join(srcDir, f), join(destDir, f));
    }
  }
}

try {
  copyDirFlat(
    join(root, "node_modules/@mediapipe/selfie_segmentation"),
    join(root, "public/mediapipe")
  );
} catch {
  /* optional */
}
try {
  mkdirSync(join(root, "public/ffmpeg"), { recursive: true });
  const umd = join(root, "node_modules/@ffmpeg/core/dist/umd");
  copyFileSync(join(umd, "ffmpeg-core.js"), join(root, "public/ffmpeg/ffmpeg-core.js"));
  copyFileSync(join(umd, "ffmpeg-core.wasm"), join(root, "public/ffmpeg/ffmpeg-core.wasm"));
} catch {
  /* optional */
}
