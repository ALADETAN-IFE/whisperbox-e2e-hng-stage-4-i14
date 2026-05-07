import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { openKeyDB } from '@/lib/db';

interface UseUnlockReturn {
  unlockPassword: string;
  setUnlockPassword: (val: string) => void;
  unlockError: string;
  setUnlockError: (val: string) => void;
  unlocking: boolean;
  handleUnlock: () => Promise<void>;
}

export function useUnlock(
  needsUnlock: boolean,
  setNeedsUnlock: (val: boolean) => void
): UseUnlockReturn {
  const { state, dispatch } = useAppState();
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  async function handleUnlock() {
    if (!unlockPassword || !state.user) return;
    setUnlocking(true);
    setUnlockError('');
    try {
      const { unwrapPrivateKey, deriveWrappingKey, importPublicKey: ipk } = await import('@/lib/crypto');
      const { savePrivateKey } = await import('@/lib/db');
      const user = state.user;
      if (!user.wrapped_private_key || !user.pbkdf2_salt) {
        throw new Error('No server-backed key found. Please log in again.');
      }
      const wrappingKey = await deriveWrappingKey(unlockPassword, user.pbkdf2_salt);
      const privateKey = await unwrapPrivateKey(user.wrapped_private_key, wrappingKey);
      let publicKey = state.publicKey;
      if (!publicKey && user.public_key) {
        try { publicKey = await ipk(user.public_key); } catch { /* ok */ }
      }
      const db = state.db ?? await openKeyDB();
      if (!state.db) dispatch({ type: 'SET_DB', db });
      await savePrivateKey(db, user.username, privateKey);
      dispatch({ type: 'SET_KEYS', privateKey, publicKey });
      setNeedsUnlock(false);
    } catch {
      setUnlockError('Incorrect password. Please try again.');
    } finally {
      setUnlocking(false);
    }
  }

  return {
    unlockPassword,
    setUnlockPassword,
    unlockError,
    setUnlockError,
    unlocking,
    handleUnlock,
  };
}
