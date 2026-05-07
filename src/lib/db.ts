import { importPrivateKey } from './crypto';

const DB_NAME = 'whisperbox_keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

export async function openKeyDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        (e.target as IDBOpenDBRequest).result.createObjectStore(STORE_NAME, { keyPath: 'username' });
      };
      req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePrivateKey(db: IDBDatabase | null, username: string, cryptoKey: CryptoKey): Promise<void> {
  const exported = await crypto.subtle.exportKey('pkcs8', cryptoKey);

  if (db) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ username, key: exported });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return;
  }

  // Fallback: sessionStorage only (never plain localStorage for private key)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  sessionStorage.setItem(`pwk_${username}`, b64);
}

export async function loadPrivateKey(db: IDBDatabase | null, username: string): Promise<CryptoKey | null> {
  if (db) {
    try {
      const result = await new Promise<{ username: string; key: ArrayBuffer } | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(username);
        req.onsuccess = () => resolve(req.result as { username: string; key: ArrayBuffer } | undefined);
        req.onerror = () => reject(req.error);
      });
      if (result) return await importPrivateKey(result.key);
    } catch {
      // fall through to sessionStorage
    }
  }

  const b64 = sessionStorage.getItem(`pwk_${username}`);
  if (b64) {
    const buf = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    return importPrivateKey(buf);
  }

  return null;
}
