import { initializeApp, type FirebaseApp } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";

function readConfig(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} | null {
  try {
    const env = import.meta.env;
    const firebaseConfig = {
      apiKey: env.VITE_FIREBASE_API_KEY as string,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
      projectId: env.VITE_FIREBASE_PROJECT_ID as string,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
      appId: env.VITE_FIREBASE_APP_ID as string,
    };
    if (
      !firebaseConfig.apiKey ||
      !firebaseConfig.authDomain ||
      !firebaseConfig.projectId ||
      !firebaseConfig.storageBucket ||
      !firebaseConfig.messagingSenderId ||
      !firebaseConfig.appId
    ) {
      return null;
    }
    return firebaseConfig;
  } catch {
    return null;
  }
}

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

export function getFirebaseStorage(): FirebaseStorage {
  const cfg = readConfig();
  if (!cfg) {
    throw new Error(
      "Missing Firebase configuration. Set VITE_FIREBASE_* in .env for builds."
    );
  }
  if (!app) {
    app = initializeApp(cfg);
    storage = getStorage(app, `gs://${cfg.storageBucket}`);
  }
  if (!storage) {
    throw new Error("Failed to initialize Firebase Storage");
  }
  return storage;
}
