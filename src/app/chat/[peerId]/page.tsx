'use client';

import { useEffect, use } from 'react';
import { useAppState } from '@/hooks/useAppState';
import ChatArea from '@/components/ChatArea';

export default function ChatPeerPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = use(params);
  const { state, dispatch } = useAppState();

  // If the user navigated here directly (e.g. typed URL or reloaded),
  // activePeer may not be set yet — restore it from the conversations list
  // or create a minimal placeholder so ChatArea can load messages immediately.
  useEffect(() => {
    if (state.activeConvoId === peerId) return; // already set

    const existing = state.conversations.find((c) => c.user_id === peerId);
    dispatch({
      type: 'SET_ACTIVE_CONVO',
      peerId,
      peer: existing ?? { user_id: peerId },
    });
  }, [peerId, state.conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  return <ChatArea />;
}
