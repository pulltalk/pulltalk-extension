import { getFirebaseStorage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
/**
 * Generates a unique filename for the video upload
 * @param prId - Optional PR ID to include in filename
 * @returns Unique filename string
 */
function generateVideoFilename(prId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const prSuffix = prId ? `_pr${prId}` : "";
    return `pulltalk_videos/video_${timestamp}_${random}${prSuffix}.webm`;
}
/**
 * Uploads a video blob to Firebase Storage
 * @param videoBlob - The video blob to upload
 * @param prId - Optional PR ID for organizing uploads
 * @returns Promise resolving to the public download URL
 * @throws {Error} If upload fails
 */
export async function uploadVideo(videoBlob, prId) {
    if (!videoBlob || videoBlob.size === 0) {
        throw new Error("Invalid video blob: empty or null");
    }
    // Check file size (Firebase Storage has limits, typically 5GB for free tier)
    const maxSize = 100 * 1024 * 1024; // 100MB limit
    if (videoBlob.size > maxSize) {
        throw new Error(`Video file too large: ${(videoBlob.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 100MB.`);
    }
    try {
        const storage = getFirebaseStorage();
        const filename = generateVideoFilename(prId);
        const storageRef = ref(storage, filename);
        // Upload the video blob
        console.log(`📤 Uploading video to Firebase Storage: ${filename} (${(videoBlob.size / 1024 / 1024).toFixed(2)}MB)`);
        const uploadResult = await uploadBytes(storageRef, videoBlob, {
            contentType: "video/webm",
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                prId: prId || "unknown",
                size: videoBlob.size.toString(),
            },
        });
        // Get the public download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);
        console.log(`✅ Video uploaded successfully: ${downloadURL}`);
        return downloadURL;
    }
    catch (error) {
        console.error("❌ Firebase upload error:", error);
        if (error instanceof Error) {
            // Provide more specific error messages
            if (error.message.includes("quota")) {
                throw new Error("Storage quota exceeded. Please contact support.");
            }
            if (error.message.includes("unauthorized") || error.message.includes("permission")) {
                throw new Error("Upload permission denied. Please check Firebase Storage rules.");
            }
            throw new Error(`Upload failed: ${error.message}`);
        }
        throw new Error("Network error during upload. Please check your connection.");
    }
}
