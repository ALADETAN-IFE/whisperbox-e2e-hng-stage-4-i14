'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import AuthScreen from '@/components/AuthScreen';
import { openKeyDB, loadPrivateKey } from '@/lib/db';
import { importPublicKey } from '@/lib/crypto';
import type { User } from '@/types';

export default function RootPage() {
  const { state, dispatch } = useAppState();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/proxy?path=${encodeURIComponent('/auth/me')}`);
        if (!res.ok) { 
          dispatch({ type: 'SET_USER', user: null }); 
          setReady(true);
          return;
        }

        const me = await res.json() as User;
        const user: User = { ...me, id: me.id ?? me.user_id ?? null };
        dispatch({ type: 'SET_USER', user });

        const db = await openKeyDB();
        dispatch({ type: 'SET_DB', db });

        const privateKey = await loadPrivateKey(db, user.username);
        let publicKey = null;
        if (user.public_key) {
          try { publicKey = await importPublicKey(user.public_key); } catch {}
        }
        dispatch({ type: 'SET_KEYS', privateKey, publicKey });

        router.replace('/chat');
      } catch {
        setReady(true);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready && !state.user) {
    return (
      <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#3390ec] border-t-transparent animate-spin" />
      </div>
    );
  }

  return <AuthScreen />;
}
