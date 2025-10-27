export async function uploadVideo(videoBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", videoBlob, "pulltalk_video.webm");

  // Replace with your backend endpoint
  const response = await fetch("https://your-backend.com/upload", {
    method: "POST",
    body: formData
  });

  if (!response.ok) throw new Error("Upload failed");

  const data = await response.json();
  return data.url; // URL returned from backend
}
