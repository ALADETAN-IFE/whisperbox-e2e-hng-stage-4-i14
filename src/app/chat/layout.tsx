"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/hooks/useAppState";
import { useAuthRestore, handleExpiredSession } from "@/hooks/useAuthRestore";
import { useUnlock } from "@/hooks/useUnlock";
import Sidebar from "@/components/Sidebar";
import NewChatModal from "@/components/NewChatModal";
import UnlockOverlay from "@/components/UnlockOverlay";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Conversation } from "@/types";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, dispatch } = useAppState();
  const router = useRouter();
  const [showNewChat, setShowNewChat] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Auth restore hook ─────────────────────────────────────────────────
  useAuthRestore(setAuthChecked, setNeedsUnlock);

  // ── Unlock hook ───────────────────────────────────────────────────────
  const {
    unlockPassword,
    setUnlockPassword,
    unlockError,
    unlocking,
    handleUnlock,
  } = useUnlock(needsUnlock, setNeedsUnlock);

  // ── Load conversations + poll ─────────────────────────────────────────
  // IMPORTANT: do NOT put state.activeConvoId / state.activePeer in deps —
  // those change on every message load and would recreate this fn + restart
  // the interval on every poll, causing an infinite loop.
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/proxy?path=${encodeURIComponent("/conversations")}`,
      );

      if (res.status === 401 || res.status === 403) {
        handleExpiredSession(router);
        return;
      }

      if (!res.ok) return; // transient server error — skip silently, do not redirect

      const data = await res.json();
      const convos: Conversation[] = Array.isArray(data)
        ? data
        : (data.conversations ?? []);
      dispatch({ type: "SET_CONVERSATIONS", conversations: convos });
    } catch {
      /* network error — non-fatal, will retry on next interval */
    }
  }, [dispatch, router]); // ← no state deps here

  useEffect(() => {
    if (!authChecked || needsUnlock) return;
    loadConversations();
    const id = setInterval(loadConversations, 10_000);
    return () => clearInterval(id);
  }, [authChecked, needsUnlock, loadConversations]);

  // ── WebSocket presence listener ───────────────────────────────────────
  useEffect(() => {
    if (!authChecked || needsUnlock) return;
    let ws: WebSocket | null = null;
    const tryConnect = () => {
      try {
        ws = new WebSocket(`wss://whisperbox.koyeb.app/ws`);
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string);
            if (msg?.type === "presence" && msg?.userId) {
              dispatch({
                type: "SET_PRESENCE",
                userId: String(msg.userId),
                online: !!msg.online,
                last_seen: msg.last_seen ?? null,
              });
            }
          } catch {
            /* ignore non-json */
          }
        };
        ws.onerror = () => {
          try {
            ws?.close();
          } catch {}
        };
      } catch {
        /* ignore */
      }
    };
    tryConnect();
    return () => {
      try {
        ws?.close();
      } catch {}
    };
  }, [authChecked, needsUnlock, dispatch]);

  // ── Select conversation → resolve name + navigate ─────────────────────
  async function handleSelectConvo(peerId: string, initialPeer?: Conversation) {
    const existing = state.conversations.find((c) => c.user_id === peerId);
    let peer: Conversation =
      existing ??
      (initialPeer
        ? ({
            ...initialPeer,
            user_id: initialPeer.id ?? initialPeer.user_id ?? peerId,
          } as Conversation)
        : ({ user_id: peerId } as Conversation));

    dispatch({ type: "SET_ACTIVE_CONVO", peerId, peer });

    try {
      const res = await fetch(
        `/api/proxy?path=${encodeURIComponent(`/users/${peerId}`)}`,
      );
      if (res.ok) {
        const data = await res.json();
        peer = {
          ...peer,
          ...data,
          user_id: peerId,
          display_name:
            data.display_name ||
            data.username ||
            peer.display_name ||
            peer.username,
        };
      }
    } catch {}

    if (!peer.public_key) {
      try {
        const res = await fetch(
          `/api/proxy?path=${encodeURIComponent(`/users/${peerId}/public-key`)}`,
        );
        if (res.ok) {
          const data = await res.json();
          peer.public_key =
            data.public_key ?? (typeof data === "string" ? data : undefined);
        }
      } catch {}
    }

    dispatch({ type: "SET_ACTIVE_CONVO", peerId, peer });
    router.push(`/chat/${peerId}`);
  }

  // ── Unlock overlay ────────────────────────────────────────────────────
  if (needsUnlock) {
    return (
      <UnlockOverlay
        unlockPassword={unlockPassword}
        onPasswordChange={setUnlockPassword}
        unlockError={unlockError}
        unlocking={unlocking}
        onUnlock={handleUnlock}
      />
    );
  }

  if (!authChecked) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f0f]">
      <Sidebar
        onSelectConvo={handleSelectConvo}
        onNewChat={() => setShowNewChat(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />
      {children}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onSelect={(peerId, user) => {
            setShowNewChat(false);
            handleSelectConvo(peerId, user as Conversation);
          }}
        />
      )}
    </div>
  );
}
