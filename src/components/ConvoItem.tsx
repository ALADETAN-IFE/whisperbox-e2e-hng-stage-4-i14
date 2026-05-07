import React from 'react';
import type { Conversation } from '@/types';
import { formatTime } from '@/utils/time';

interface ConvoItemProps {
  convo: Conversation;
  isActive: boolean;
  preview?: string;
  onClick: () => void;
}

export default function ConvoItem({ convo, isActive, preview, onClick }: ConvoItemProps) {
  const name    = convo.display_name || convo.username || 'Unknown';
  const initial = name[0]?.toUpperCase() ?? '?';
  const time    = convo.last_message_at ? formatTime(convo.last_message_at) : '';

  return (
    <div
      onClick={onClick}
      key={convo.user_id}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
        ${isActive ? 'bg-[#3390ec]' : 'hover:bg-white/3'}`}
    >
      <div className="relative">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold shrink-0
          ${isActive ? 'bg-white text-[#3390ec]' : 'bg-[#2b5278] text-white'}`}
        >
          {initial}
        </div>
        {convo.online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#1c1c1c]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] truncate">{name}</div>
        <div className={`text-[14px] truncate ${isActive ? 'text-white/80' : 'text-[#707579]'}`}>
          {preview ?? 'Tap to open chat'}
        </div>
      </div>
      {time && (
        <div className={`text-[12px] self-end mb-1 shrink-0 ${isActive ? 'text-white' : 'text-[#707579]'}`}>
          {time}
        </div>
      )}
    </div>
  );
}
