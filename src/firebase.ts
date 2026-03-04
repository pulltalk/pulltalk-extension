import { initializeApp, type FirebaseApp } from "firebase/app";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Firebase configuration

 */
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
    !firebaseConfig.apiKey ||
    !firebaseConfig.authDomain ||
    !firebaseConfig.projectId ||
    !firebaseConfig.storageBucket ||
    !firebaseConfig.messagingSenderId ||
    !firebaseConfig.appId
) {
    throw new Error("Missing Firebase configuration. Check your .env file.");
}

let app: FirebaseApp | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Initializes Firebase app and returns the app instance
 * @returns Firebase app instance
 */
export function initializeFirebase(): FirebaseApp {
    if (!app) {
        app = initializeApp(firebaseConfig);
        // Use explicit bucket to avoid "no default bucket" errors at runtime.
        storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
    }
    return app;
}

/**
 * Gets Firebase Storage instance
 * @returns Firebase Storage instance
 */
export function getFirebaseStorage(): FirebaseStorage {
    if (!storage) {
        initializeFirebase();
        if (!storage) {
            throw new Error("Failed to initialize Firebase Storage");
        }
    }
    return storage;
}

/**
 * Initializes Firebase on module load
 */
initializeFirebase();

