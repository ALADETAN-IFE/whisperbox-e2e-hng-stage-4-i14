"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search } from "lucide-react";
import UserRow from "./UserRow";
import { useAppState } from "@/hooks/useAppState";

interface User {
  user_id?: string;
  id?: string;
  username: string;
  display_name?: string;
}

interface NewChatModalProps {
  onClose: () => void;
  onSelect: (peerId: string, user?: User) => void;
}

export default function NewChatModal({ onClose, onSelect }: NewChatModalProps) {
  const { state } = useAppState();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function search(q: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy?path=${encodeURIComponent(`/users/search?q=${encodeURIComponent(q)}`)}`,
      );
      const data = await res.json();
      console.log("[user search raw]", data); // temp: inspect API shape
      setResults(Array.isArray(data) ? data : (data.users ?? []));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      queueMicrotask(() => setResults([]));
      return;
    }
    timerRef.current = setTimeout(() => search(query), 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const myId = state.user?.id ?? state.user?.user_id;
  const existingIds = new Set(state.conversations.map((c) => c.user_id));

  const contacts = results.filter((u) => {
    const uid = u.user_id ?? u.id;
    return uid && uid !== myId && existingIds.has(uid);
  });
  const global = results.filter((u) => {
    const uid = u.user_id ?? u.id;
    return uid && uid !== myId && !existingIds.has(uid);
  });

  function handleSelect(u: User) {
    const uid = u.user_id ?? u.id;
    if (uid) {
      onSelect(uid, u);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#1c1c1c] w-100 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
          <span className="text-[18px] font-semibold">New Message</span>
          <button
            onClick={onClose}
            className="text-[#707579] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 relative flex items-center gap-2">
          <Search size={16} className="text-[#707579] absolute left-7" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-white/8 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm outline-none focus:border-[#3390ec]"
          />
        </div>

        {/* Results */}
        <div className="max-h-100 overflow-y-auto pb-2">
          {loading && (
            <div className="py-8 text-center text-sm text-[#707579]">
              Searching…
            </div>
          )}
          {!loading && query && !results.length && (
            <div className="py-8 text-center text-sm text-[#707579]">
              No users found
            </div>
          )}
          {!loading && contacts.length > 0 && (
            <>
              <div className="px-4 py-2 text-[13px] font-bold text-[#3390ec] uppercase bg-white/2">
                Chats and Contacts
              </div>
              {contacts.map((u) => (
                <UserRow
                  key={u.user_id ?? u.id}
                  user={u}
                  onClick={() => handleSelect(u)}
                />
              ))}
            </>
          )}
          {!loading && global.length > 0 && (
            <>
              <div className="px-4 py-2 text-[13px] font-bold text-[#3390ec] uppercase bg-white/2">
                Global search
              </div>
              {global.map((u) => (
                <UserRow
                  key={u.user_id ?? u.id}
                  user={u}
                  onClick={() => handleSelect(u)}
                />
              ))}
            </>
          )}
          {!query && (
            <div className="py-8 text-center text-sm text-[#707579]">
              Type a username to search
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
