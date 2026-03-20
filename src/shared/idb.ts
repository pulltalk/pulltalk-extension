const DB_NAME = "pulltalk-recordings";
const DB_VERSION = 1;
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = (): void => {
      reject(req.error ?? new Error("IndexedDB open failed"));
    };
    req.onsuccess = (): void => {
      resolve(req.result);
    };
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function idbPutBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = (): void => {
      resolve();
    };
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("IndexedDB put failed"));
    };
    tx.objectStore(STORE).put(blob, key);
  });
}

export async function idbGetBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = (): void => {
      resolve(req.result as Blob | undefined);
    };
    req.onerror = (): void => {
      reject(req.error ?? new Error("IndexedDB get failed"));
    };
  });
}

export async function idbDeleteBlob(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = (): void => {
      resolve();
    };
    tx.onerror = (): void => {
      reject(tx.error ?? new Error("IndexedDB delete failed"));
    };
    tx.objectStore(STORE).delete(key);
  });
}

export function makeBlobKey(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
