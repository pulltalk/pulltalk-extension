import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
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
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
    if (
      !firebaseConfig.apiKey
      || !firebaseConfig.authDomain
      || !firebaseConfig.projectId
      || !firebaseConfig.storageBucket
      || !firebaseConfig.messagingSenderId
      || !firebaseConfig.appId
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
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null;
}

/** Server-side transcode path (Firestore job + Cloud Function). */
export function isServerTranscodeEnabled(): boolean {
  return import.meta.env.VITE_PULLTALK_SERVER_TRANSCODE === "true";
}

function ensureFirebaseApp(): FirebaseApp {
  const cfg = readConfig();
  if (!cfg) {
    throw new Error(
      "Missing Firebase configuration. Set VITE_FIREBASE_* in .env for builds.",
    );
  }
  if (!app) {
    app = initializeApp(cfg);
    storage = getStorage(app, `gs://${cfg.storageBucket}`);
  }
  return app;
}

export function getFirebaseStorage(): FirebaseStorage {
  ensureFirebaseApp();
  if (!storage) {
    throw new Error("Failed to initialize Firebase Storage");
  }
  return storage;
}

export function getFirebaseAuth(): Auth {
  const a = ensureFirebaseApp();
  if (!auth) {
    auth = getAuth(a);
  }
  return auth;
}

export function getFirebaseFirestore(): Firestore {
  if (!isServerTranscodeEnabled()) {
    throw new Error("Server transcode is not enabled (set VITE_PULLTALK_SERVER_TRANSCODE=true).");
  }
  const a = ensureFirebaseApp();
  if (!firestore) {
    firestore = getFirestore(a);
  }
  return firestore;
}

/** Required for Firestore/Storage rules that scope jobs by uid. */
export async function ensureAnonymousFirebaseAuth(): Promise<string> {
  const a = getFirebaseAuth();
  if (a.currentUser?.uid) {
    return a.currentUser.uid;
  }
  const cred = await signInAnonymously(a);
  return cred.user.uid;
}
