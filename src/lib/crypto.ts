import type { MessagePayload } from '@/types';

const RSA_PARAMS = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
} as const;

/* ── KEY GENERATION ── */
export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ['encrypt', 'decrypt']);
}

/* ── EXPORT / IMPORT ── */
export async function exportKey(key: CryptoKey, format: 'spki' | 'pkcs8' = 'spki'): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', binary, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}

export async function importPrivateKey(buffer: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt', 'unwrapKey']
  );
}

/* ── PASSWORD-BASED KEY WRAPPING (for server backup) ── */
export async function deriveWrappingKey(password: string, saltB64: string): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function wrapPrivateKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('pkcs8', keyToWrap);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, exported);
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function unwrapPrivateKey(wrappedB64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const combined = Uint8Array.from(atob(wrappedB64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, data);
  return crypto.subtle.importKey('pkcs8', decrypted, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
}

/* ── HYBRID ENCRYPTION (RSA-OAEP wraps an AES-GCM key) ── */
export async function encryptMessageHybrid(
  recipientPubKey: CryptoKey,
  plaintext: string,
  senderPubKey: CryptoKey | null
): Promise<MessagePayload> {
  // 1. Generate a fresh AES-GCM session key
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Encrypt the message
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  // 3. Wrap the AES key for recipient (so they can decrypt)
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, recipientPubKey, rawAesKey);

  // 4. Also wrap the AES key for ourselves (so sender can read own sent messages)
  let encryptedKeyForSelf: string | null = null;
  if (senderPubKey) {
    const selfEncrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, senderPubKey, rawAesKey);
    encryptedKeyForSelf = btoa(String.fromCharCode(...new Uint8Array(selfEncrypted)));
  }

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
    encryptedKey: btoa(String.fromCharCode(...new Uint8Array(encryptedKey))),
    encryptedKeyForSelf,
  };
}

export async function decryptMessageHybrid(
  rsaPrivateKey: CryptoKey,
  payload: MessagePayload,
  isSent: boolean
): Promise<string | null> {
  try {
    // Use the right encrypted AES key depending on message direction
    const encKeyB64 = isSent && payload.encryptedKeyForSelf
      ? payload.encryptedKeyForSelf
      : payload.encryptedKey;

    const encryptedAesKey = Uint8Array.from(atob(encKeyB64), (c) => c.charCodeAt(0));
    const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, rsaPrivateKey, encryptedAesKey);
    const aesKey = await crypto.subtle.importKey('raw', rawAesKey, 'AES-GCM', true, ['decrypt']);
    const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
