"use client";

import { useState } from "react";
import { Search, Plus, LogOut, PanelLeft, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAppState } from "@/hooks/useAppState";
import { showToast } from "./Toast";
import ConvoItem from "./ConvoItem";
import type { AuthenticatedUser } from "@/types";

interface SidebarProps {
  onSelectConvo: (peerId: string) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({
  onSelectConvo,
  onNewChat,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { state, dispatch, pollRef } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState("");

  const activePeerId = pathname.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const filtered = state.conversations.filter((c) => {
    const name = c.display_name || c.username || "";
    return !filter || name.toLowerCase().includes(filter.toLowerCase());
  });

  async function handleLogout() {
    if (pollRef.current) clearInterval(pollRef.current);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    sessionStorage.removeItem("wb_user");
    sessionStorage.removeItem("wb_active_convo");
    dispatch({ type: "LOGOUT" });
    showToast("Signed out", "default");
    router.replace("/");
  }

  const currentUser = state.user as AuthenticatedUser | null;
  const userName = currentUser?.display_name || currentUser?.username || "?";
  const initial = userName[0]?.toUpperCase() ?? "?";

  
  if (collapsed) {
    return (
      <div className="w-13 min-w-13 bg-[#1c1c1c] border-r border-white/8 flex flex-col h-full items-center py-3 gap-3">
        <button
          onClick={onToggleCollapse}
          title="Open sidebar"
          className="w-9 h-9 flex items-center justify-center rounded-full text-[#707579] hover:text-white hover:bg-white/8 transition-colors"
        >
          <PanelLeft size={18} />
        </button>

        
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto w-full items-center pt-1">
          {filtered.map((c) => {
            const name = c.display_name || c.username || "?";
            const ini = name[0]?.toUpperCase() ?? "?";
            const isActive = c.user_id === activePeerId;
            return (
              <button
                key={c.user_id}
                onClick={() => onSelectConvo(c.user_id)}
                title={name}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-colors shrink-0
                  ${isActive ? "bg-[#3390ec] text-white" : "bg-[#2b5278] text-white hover:bg-[#3390ec]/70"}`}
              >
                {ini}
                {c.online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#1c1c1c]" />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-[#2b5278] flex items-center justify-center text-xs font-semibold shrink-0">
            {initial}
          </div>
          {currentUser?.online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#1c1c1c]" />
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden max-md:fixed max-md:inset-0 max-md:bg-black/50 max-md:z-30" onClick={onToggleCollapse} />
      <div className="w-[320px] min-w-[320px] bg-[#1c1c1c] border-r border-white/8 flex flex-col h-full max-md:fixed max-md:w-full max-md:z-40">
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            onClick={onToggleCollapse}
            title="Close sidebar"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#707579] hover:text-white hover:bg-white/8 transition-colors shrink-0 max-md:hidden"
          >
            <PanelLeft size={17} />
          </button>
          <button
            onClick={onToggleCollapse}
            title="Close sidebar"
            className="hidden max-md:flex w-8 h-8 items-center justify-center rounded-full text-[#707579] hover:text-white hover:bg-white/8 transition-colors shrink-0"
          >
            <X size={17} />
          </button>

        <div className="flex-1 flex items-center gap-2 bg-[#0f0f0f] rounded-full px-3 py-1.5">
          <Search size={15} className="text-[#707579] shrink-0" />
          <input
            type="text"
            placeholder="Search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-full placeholder:text-[#707579]"
          />
        </div>
        <button
          onClick={onNewChat}
          className="w-8 h-8 rounded-full bg-[#3390ec] flex items-center justify-center shrink-0"
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>

      
      {/* <div className="flex gap-5 px-4 pb-0.5 border-b border-white/8">
        {["All", "Private", "Groups"].map((t) => (
          <button
            key={t}
            className={`py-2 text-[13px] font-semibold relative transition-colors
              ${t === "All" ? "text-[#3390ec]" : "text-[#707579]"}`}
          >
            {t}
            {t === "All" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.75 bg-[#3390ec] rounded-t" />
            )}
          </button>
        ))}
      </div> */}

      
      <div className="flex-1 overflow-y-auto">
        {!filtered.length ? (
          <div className="py-10 text-center text-sm text-[#707579]">
            {filter ? "No results found" : "No conversations yet"}
          </div>
        ) : (
          filtered.map((c) => (
            <ConvoItem
              key={c.user_id}
              convo={c}
              isActive={c.user_id === activePeerId}
              preview={state.messagePreviewCache[c.user_id]}
              onClick={() => onSelectConvo(c.user_id)}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-white/8">
        <div className="flex items-center gap-2.5 bg-white/5 px-3 py-2 rounded-xl">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-[#2b5278] flex items-center justify-center text-xs font-semibold shrink-0">
              {initial}
            </div>
            {currentUser?.online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1c1c1c]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">{userName}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#707579] hover:text-white transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

