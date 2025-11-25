let mediaRecorder = null;
let recordedChunks = [];
let displayStream = null;
let audioStream = null;
let combinedStream = null;
/**
 * Starts recording screen and microphone audio
 * @throws {Error} If media devices are not available or permission is denied
 */
export async function startRecording() {
    try {
        // Check if already recording
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            throw new Error("Recording already in progress");
        }
        // Request screen capture
        displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
        });
        // Handle user stopping screen share
        displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
            if (mediaRecorder && mediaRecorder.state !== "inactive") {
                stopRecording().catch(console.error);
            }
        });
        // Request microphone access
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        catch (error) {
            console.warn("Microphone access denied, continuing with screen audio only", error);
            // Continue with just display stream if mic is denied
        }
        // Combine streams
        const tracks = [...displayStream.getTracks()];
        if (audioStream) {
            tracks.push(...audioStream.getTracks());
        }
        combinedStream = new MediaStream(tracks);
        // Check if MediaRecorder supports the mime type
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : MediaRecorder.isTypeSupported("video/webm")
                ? "video/webm"
                : "";
        if (!mimeType) {
            throw new Error("No supported video format found");
        }
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onerror = (event) => {
            console.error("MediaRecorder error:", event);
            cleanupStreams();
        };
        mediaRecorder.start();
    }
    catch (error) {
        cleanupStreams();
        throw error instanceof Error ? error : new Error("Failed to start recording");
    }
}
/**
 * Stops recording and returns the recorded video blob
 * @returns Promise resolving to the recorded video blob
 * @throws {Error} If no recording is in progress
 */
export async function stopRecording() {
    return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            reject(new Error("No recording in progress"));
            return;
        }
        mediaRecorder.onstop = () => {
            try {
                const blob = new Blob(recordedChunks, { type: "video/webm" });
                cleanupStreams();
                resolve(blob);
            }
            catch (error) {
                cleanupStreams();
                reject(error instanceof Error ? error : new Error("Failed to create video blob"));
            }
        };
        mediaRecorder.onerror = (event) => {
            cleanupStreams();
            reject(new Error("Error stopping recording"));
        };
        mediaRecorder.stop();
        mediaRecorder = null;
    });
}
/**
 * Cleans up all media streams and tracks
 */
function cleanupStreams() {
    // Stop all tracks
    [displayStream, audioStream, combinedStream].forEach((stream) => {
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.stop();
            });
        }
    });
    displayStream = null;
    audioStream = null;
    combinedStream = null;
    recordedChunks = [];
}
/**
 * Checks if recording is currently in progress
 */
export function isRecording() {
    return mediaRecorder !== null && mediaRecorder.state !== "inactive";
}
