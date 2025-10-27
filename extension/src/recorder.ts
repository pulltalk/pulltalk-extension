let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];

export async function startRecording(): Promise<void> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true
  });

  // Optionally combine microphone audio
  const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const combinedStream = new MediaStream([
    ...stream.getTracks(),
    ...audioStream.getTracks()
  ]);

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm" });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };

  mediaRecorder.start();
}

export async function stopRecording(): Promise<Blob> {
  return new Promise((resolve) => {
    if (!mediaRecorder) throw new Error("No recording in progress");

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      resolve(blob);
    };

    mediaRecorder.stop();
    mediaRecorder = null;
  });
}
