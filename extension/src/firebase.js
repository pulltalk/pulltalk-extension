import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
/**
 * Firebase configuration
 * Note: In a production extension, consider storing sensitive config in environment variables
 */
const firebaseConfig = {
    apiKey: "[REDACTED-API-KEY]",
    authDomain: "[REDACTED-PROJECT].firebaseapp.com",
    projectId: "[REDACTED-PROJECT]",
    storageBucket: "[REDACTED-PROJECT].firebasestorage.app",
    messagingSenderId: "[REDACTED-SENDER-ID]",
    appId: "1:[REDACTED-SENDER-ID]:web:[REDACTED-APP-HASH]",
};
let app = null;
let storage = null;
/**
 * Initializes Firebase app and returns the app instance
 * @returns Firebase app instance
 */
export function initializeFirebase() {
    if (!app) {
        app = initializeApp(firebaseConfig);
        storage = getStorage(app);
    }
    return app;
}
/**
 * Gets Firebase Storage instance
 * @returns Firebase Storage instance
 */
export function getFirebaseStorage() {
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
