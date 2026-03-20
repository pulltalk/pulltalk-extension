import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "./firebase";

export async function uploadStagingWebm(
  blob: Blob,
  storagePath: string,
): Promise<void> {
  const storage = getFirebaseStorage();
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: "video/webm",
  });
}
