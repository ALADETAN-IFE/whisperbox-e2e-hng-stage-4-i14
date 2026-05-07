import React from 'react';

interface User {
  user_id?: string;
  id?: string;
  username: string;
  display_name?: string;
}

export default function UserRow({ user, onClick }: { user: User; onClick: () => void }) {
  const name = user.display_name || user.username;
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-[#2b5278] flex items-center justify-center font-semibold text-sm shrink-0">
        {initial}
      </div>
      <div>
        <div className="text-sm font-semibold">{name}</div>
        <div className="text-xs text-[#707579]">@{user.username}</div>
      </div>
    </div>
  );
}
