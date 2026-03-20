/// <reference types="vite/client" />

type FirebaseEnv = {
    readonly VITE_FIREBASE_API_KEY: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN: string;
    readonly VITE_FIREBASE_PROJECT_ID: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    readonly VITE_FIREBASE_APP_ID: string;
    /** When `"true"`, large/heavy edits use Firebase Cloud Functions instead of ffmpeg.wasm. */
    readonly VITE_PULLTALK_SERVER_TRANSCODE?: string;
    /**
     * When `"true"`, editor accepts `?devSample=1` to open a cached test WebM without recording.
     * Omit in production builds you ship to users.
     */
    readonly VITE_PULLTALK_EDITOR_DEV_TOOLS?: string;
};

declare global {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface ImportMetaEnv extends FirebaseEnv { }
    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }
}

export { };
