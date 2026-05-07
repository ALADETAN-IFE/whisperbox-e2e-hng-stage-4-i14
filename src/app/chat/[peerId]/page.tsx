'use client';

import { useEffect, use } from 'react';
import { useAppState } from '@/hooks/useAppState';
import ChatArea from '@/components/ChatArea';

export default function ChatPeerPage({ params }: { params: Promise<{ peerId: string }> }) {
  const { peerId } = use(params);
  const { state, dispatch } = useAppState();

  useEffect(() => {
    if (state.activeConvoId === peerId) return;

    const existing = state.conversations.find((c) => c.user_id === peerId);
    dispatch({
      type: 'SET_ACTIVE_CONVO',
      peerId,
      peer: existing ?? { user_id: peerId },
    });
  }, [peerId, state.conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  return <ChatArea />;
}
