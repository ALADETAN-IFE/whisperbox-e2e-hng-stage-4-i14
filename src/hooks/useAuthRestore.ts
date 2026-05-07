import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { openKeyDB, loadPrivateKey } from '@/lib/db';
import { importPublicKey } from '@/lib/crypto';
import type { User } from '@/types';

export async function handleExpiredSession(router: ReturnType<typeof useRouter>) {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  sessionStorage.clear();
  router.replace('/');
}

export function useAuthRestore(
  setAuthChecked: (val: boolean) => void,
  setNeedsUnlock: (val: boolean) => void
): void {
  const { state, dispatch } = useAppState();
  const router = useRouter();

  useEffect(() => {
    if (state.user) {
      if (!state.privateKey) {
        (async () => {
          const db = state.db ?? await openKeyDB();
          if (!state.db) dispatch({ type: 'SET_DB', db });
          const privateKey = await loadPrivateKey(db, state.user!.username);
          if (privateKey) {
            let publicKey = state.publicKey;
            if (!publicKey && state.user!.public_key) {
              try { publicKey = await importPublicKey(state.user!.public_key); } catch { /* ok */ }
            }
            dispatch({ type: 'SET_KEYS', privateKey, publicKey });
          } else if (state.user!.wrapped_private_key) {
            setNeedsUnlock(true);
          }
          queueMicrotask(() => setAuthChecked(true));
        })();
      } else {
        queueMicrotask(() => setAuthChecked(true));
      }
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/proxy?path=${encodeURIComponent('/auth/me')}`);

        if (res.status === 401 || res.status === 403) {
          handleExpiredSession(router);
          return;
        }
        if (!res.ok) return; // transient server error — stay on current page

        const me = await res.json() as User;
        const user: User = { ...me, id: me.id ?? me.user_id ?? null };
        dispatch({ type: 'SET_USER', user });

        const db = await openKeyDB();
        dispatch({ type: 'SET_DB', db });

        const privateKey = await loadPrivateKey(db, user.username);
        let publicKey = null;
        if (user.public_key) {
          try { publicKey = await importPublicKey(user.public_key); } catch { /* ok */ }
        }

        if (privateKey) {
          dispatch({ type: 'SET_KEYS', privateKey, publicKey });
          queueMicrotask(() => setAuthChecked(true));
        } else if (user.wrapped_private_key) {
          dispatch({ type: 'SET_KEYS', privateKey: null, publicKey });
          setNeedsUnlock(true);
          queueMicrotask(() => setAuthChecked(true));
        } else {
          router.replace('/');
        }
      } catch {
        // Transient network error (e.g. HMR reload, brief offline) — do NOT redirect.
        // Only 401/403 responses above trigger a redirect.
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
