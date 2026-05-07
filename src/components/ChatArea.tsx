"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  SendHorizonal,
  Lock,
  Loader2,
  Paperclip,
  Smile,
} from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { showToast } from "./Toast";
import MessageBubble from "./MessageBubble";
import DateSeparator from "./DateSeparator";
import {
  encryptMessageHybrid,
  decryptMessageHybrid,
  importPublicKey,
} from "@/lib/crypto";
import type { Conversation, Message, MessagePayload } from "@/types";
import { formatLastSeen, formatDateSeparator } from "@/utils/time";

async function fetchPeerPublicKey(peerId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/proxy?path=${encodeURIComponent(`/users/${peerId}/public-key`)}`,
    );
    const data = (await res.json()) as { public_key?: string };
    return data.public_key ?? null;
  } catch {
    return null;
  }
}

async function fetchPeerProfile(peerId: string): Promise<Conversation | null> {
  try {
    const res = await fetch(
      `/api/proxy?path=${encodeURIComponent(`/users/${peerId}`)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as Conversation;
  } catch {
    return null;
  }
}

function extractPayload(msg: Message): MessagePayload | null {
  const raw = msg.payload ?? msg.encrypted_payload ?? msg.content ?? null;
  if (!raw) return null;
  if (typeof raw === "object" && "ciphertext" in raw)
    return raw as MessagePayload;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as MessagePayload;
      if (p.ciphertext) return p;
    } catch {}
  }
  return null;
}

async function decryptOne(
  msg: Message,
  myId: string | null,
  privateKey: CryptoKey,
): Promise<{ text: string; isSent: boolean }> {
  const senderId = msg.sender_id ?? msg.sender?.id ?? msg.from_user_id ?? null;
  const isSent = !!myId && !!senderId && String(senderId) === String(myId);
  const payload = extractPayload(msg);

  if (!payload) {
    const raw = msg.content ?? msg.text ?? "";
    return { text: raw || "(empty message)", isSent };
  }

  const text = await decryptMessageHybrid(privateKey, payload, isSent);
  return { text: text ?? "⚠️ Could not decrypt", isSent };
}

type DecryptedMessage = {
  id: string;
  text: string;
  isSent: boolean;
  ts: Date;
  optimistic?: boolean;
};

export default function ChatArea() {
  const { state, dispatch, pollRef } = useAppState();
  const { activeConvoId, activePeer, privateKey, publicKey, user } = state;
  const router = useRouter();

  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCountRef = useRef(0);
  const peerKeyCache = useRef<Record<string, CryptoKey>>({});

  useEffect(() => {
    if (!activeConvoId) return;
    lastCountRef.current = 0;
    queueMicrotask(() => setMessages([]));
  }, [activeConvoId]);

  const loadMessages = useCallback(
    async (silent: boolean) => {
      if (!activeConvoId || !privateKey) return;
      if (!silent) setLoading(true);

      try {
        const res = await fetch(
          `/api/proxy?path=${encodeURIComponent(`/conversations/${activeConvoId}/messages`)}`,
        );
        if (res.status === 401 || res.status === 403) {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
          router.replace("/");
          return;
        }
        const data = (await res.json()) as Message[] | { messages?: Message[] };
        const msgs: Message[] = Array.isArray(data)
          ? data
          : (data.messages ?? []);

        if (silent && msgs.length === lastCountRef.current) return;
        lastCountRef.current = msgs.length;

        const myId = user?.id ?? user?.user_id ?? null;

        const decoded = await Promise.all(
          msgs.map(async (msg) => {
            const { text, isSent } = await decryptOne(msg, myId, privateKey);
            const ts = new Date(msg.created_at ?? msg.timestamp ?? Date.now());
            return {
              id: String(msg.id ?? Math.random()),
              text,
              isSent,
              ts,
            };
          }),
        );

        if (activeConvoId && decoded.length > 0) {
          const last = decoded[decoded.length - 1];
          dispatch({
            type: "SET_PREVIEW",
            peerId: activeConvoId,
            preview: (last.isSent ? "You: " : "") + last.text,
          });
        }

        const sorted = [...decoded].sort(
          (a, b) => a.ts.getTime() - b.ts.getTime(),
        );

        setMessages((prev) => {
          const optimisticOnly = prev.filter((m) => m.optimistic);
          const stillPending = optimisticOnly.filter(
            (opt) => !sorted.some((d) => d.text === opt.text && d.isSent),
          );
          return [...sorted, ...stillPending];
        });

        setTimeout(() => {
          containerRef.current?.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: silent ? "smooth" : "auto",
          });
        }, 50);
      } catch {
        if (!silent) showToast("Failed to load messages", "error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeConvoId, privateKey, user, dispatch, router],
  );

  useEffect(() => {
    queueMicrotask(() => loadMessages(false));
  }, [activeConvoId, loadMessages]);

  const loadRef = useRef(loadMessages);
  useEffect(() => {
    loadRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadRef.current(true), 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeConvoId) return;
    const hasName = !!(activePeer?.display_name || activePeer?.username);
    const hasPresence = !!(
      activePeer?.online ||
      activePeer?.last_seen ||
      activePeer?.last_active ||
      activePeer?.last_message_at
    );
    if (hasName && hasPresence) return;

    (async () => {
      const profile = await fetchPeerProfile(activeConvoId);
      if (!profile) return;
      const merged: Conversation = {
        ...(activePeer ?? { user_id: activeConvoId }),
        ...profile,
        user_id: activeConvoId,
        display_name: profile.display_name || profile.username,
        online: activePeer?.online ?? profile.online,
        last_message_at:
          activePeer?.last_message_at ??
          profile.last_seen ??
          profile.last_message_at,
      };
      dispatch({
        type: "SET_ACTIVE_CONVO",
        peerId: activeConvoId,
        peer: merged,
      });
    })();
  }, [activeConvoId, activePeer?.display_name, activePeer?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !activeConvoId || sending) return;

    let peerCryptoKey = peerKeyCache.current[activeConvoId];
    if (!peerCryptoKey) {
      const pkB64 =
        activePeer?.public_key ?? (await fetchPeerPublicKey(activeConvoId));
      if (!pkB64) {
        showToast("Cannot get recipient public key", "error");
        return;
      }
      try {
        peerCryptoKey = await importPublicKey(pkB64);
        peerKeyCache.current[activeConvoId] = peerCryptoKey;
      } catch {
        showToast("Invalid recipient key", "error");
        return;
      }
    }

    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "";

    const optimisticId = `opt-${Date.now()}-${Math.random()}`;
    const optimisticMsg: DecryptedMessage = {
      id: optimisticId,
      text,
      isSent: true,
      ts: new Date(),
      optimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);

    setSending(true);

    try {
      const payload = await encryptMessageHybrid(
        peerCryptoKey,
        text,
        publicKey,
      );
      await fetch("/api/proxy?path=" + encodeURIComponent("/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activeConvoId, payload }),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticId ? { ...m, optimistic: false } : m,
        ),
      );

      lastCountRef.current = 0;
      await loadMessages(true);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInputText(text);
      showToast("Send failed: " + (e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(e: ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.style.height = "";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
    setInputText(el.value);
  }

  if (!activeConvoId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0e1621] relative">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10l5 5m10-5l-5 5m30 0l5 5m10-5l-5 5m-50 40l5 5m10-5l-5 5m30 0l5 5m10-5l-5 5' stroke='%23ffffff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="bg-black/30 px-4 py-2 rounded-full text-sm text-white relative z-10">
          Select a chat to start messaging
        </div>
      </div>
    );
  }

  const peerName =
    activePeer?.display_name ?? activePeer?.username ?? "Loading...";

  const rawPresence = activePeer?.online
    ? "online"
    : (activePeer?.last_seen ?? activePeer?.last_active ?? null);
  const presenceText =
    rawPresence === "online"
      ? "Online"
      : rawPresence
        ? `Last seen ${formatLastSeen(rawPresence)}`
        : "End-to-End Encrypted";
  const initial = peerName[0]?.toUpperCase() ?? "?";

  const itemsWithSeparators = buildItemsWithSeparators(messages);

  return (
    <div className="flex-1 flex flex-col bg-[#0e1621] relative">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10l5 5m10-5l-5 5m30 0l5 5m10-5l-5 5m-50 40l5 5m10-5l-5 5m30 0l5 5m10-5l-5 5' stroke='%23ffffff' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="h-14 bg-[#1c1c1c] border-b border-white/8 flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#2b5278] flex items-center justify-center text-sm font-semibold">
            {initial}
          </div>
          <div>
            <div className="font-semibold text-[15px]">{peerName}</div>
            <div className="text-[13px] text-[#3390ec] flex items-center gap-1">
              <Lock size={10} /> {presenceText}
            </div>
          </div>
        </div>
        <button
          onClick={() => loadMessages(false)}
          className="text-[#707579] hover:text-white transition-colors p-1"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 z-5"
      >
        {loading && (
          <div className="flex items-center gap-2 text-[#707579] text-sm mx-auto my-4">
            <Loader2 size={14} className="animate-spin" />
            Decrypting messages…
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-sm text-[#707579] my-auto">
            No messages yet — say hello 👋
          </div>
        )}
        {itemsWithSeparators.map((item) =>
          item.type === "separator" ? (
            <DateSeparator key={item.key} label={item.label} />
          ) : (
            <MessageBubble
              key={item.msg.id}
              text={item.msg.text}
              isSent={item.msg.isSent}
              ts={item.msg.ts}
              optimistic={item.msg.optimistic}
            />
          ),
        )}
      </div>

      <div className="px-4 pb-5 pt-2.5 z-10 shrink-0">
        <div className="bg-[#1c1c1c] rounded-xl flex items-end gap-3 px-3 py-2">
          <button className="text-[#707579] hover:text-white transition-colors p-1 shrink-0">
            <Paperclip size={22} />
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Write a message..."
            value={inputText}
            onChange={autoResize}
            onKeyDown={handleKey}
            className="flex-1 bg-transparent border-none outline-none text-white text-[15px] resize-none max-h-50 py-1 placeholder:text-[#707579]"
          />
          <button className="text-[#707579] hover:text-white transition-colors p-1 shrink-0">
            <Smile size={22} />
          </button>
          <button
            onClick={sendMessage}
            disabled={!inputText.trim() || sending}
            className="text-[#3390ec] disabled:opacity-30 transition-opacity p-1 shrink-0"
          >
            {sending ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <SendHorizonal size={24} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type SeparatorItem = { type: "separator"; key: string; label: string };
type MessageItem = { type: "message"; msg: DecryptedMessage };

function buildItemsWithSeparators(
  messages: DecryptedMessage[],
): (SeparatorItem | MessageItem)[] {
  const result: (SeparatorItem | MessageItem)[] = [];
  let lastDateStr = "";

  for (const msg of messages) {
    const dateStr = msg.ts.toDateString();
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      result.push({
        type: "separator",
        key: `sep-${dateStr}`,
        label: formatDateSeparator(msg.ts),
      });
    }
    result.push({ type: "message", msg });
  }

  return result;
}
