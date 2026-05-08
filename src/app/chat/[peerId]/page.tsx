"use client";

import { useEffect, useRef, use } from "react";
import { useAppState } from "@/hooks/useAppState";
import ChatArea from "@/components/ChatArea";
import type { Conversation } from "@/types";

export default function ChatPeerPage({
  params,
}: {
  params: Promise<{ peerId: string }>;
}) {
  const { peerId } = use(params);
  const { state, dispatch } = useAppState();
  const fetchedRef = useRef(false); 

  useEffect(() => {
    if (
      state.activeConvoId === peerId &&
      (state.activePeer?.display_name || state.activePeer?.username)
    )
      return;


    const existing = state.conversations.find((c) => c.user_id === peerId);
    if (existing?.display_name || existing?.username) {
      dispatch({ type: "SET_ACTIVE_CONVO", peerId, peer: existing });
      return;
    }

    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const res = await fetch(
          `/api/proxy?path=${encodeURIComponent("/conversations")}`,
        );
        if (res.ok) {
          const data = await res.json();
          const list: Conversation[] = Array.isArray(data)
            ? data
            : (data.conversations ?? []);
          if (list.length > 0)
            dispatch({ type: "SET_CONVERSATIONS", conversations: list });
          const found = list.find((c) => c.user_id === peerId);
          if (found) {
            dispatch({ type: "SET_ACTIVE_CONVO", peerId, peer: found });
            return;
          }
        }
      } catch {
       
      }

      dispatch({
        type: "SET_ACTIVE_CONVO",
        peerId,
        peer: existing ?? { user_id: peerId },
      });
    })();
  }, [peerId, state.conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  return <ChatArea />;
}
