import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { formatTimeFull } from '@/utils/time';

export default function MessageBubble({
  text,
  isSent,
  ts,
  optimistic,
}: {
  text: string;
  isSent: boolean;
  ts: Date;
  optimistic?: boolean;
}) {
  return (
    <div
      className={`flex flex-col max-w-[85%] ${isSent ? 'self-end items-end' : 'self-start items-start'}`}
    >
      <div
        className={`px-3 py-2 rounded-xl text-[15px] leading-snug wrap-break-word
          ${
            isSent
              ? 'bg-[#2b5278] text-white rounded-br-sm'
              : 'bg-[#212121] text-white rounded-bl-sm'
          }`}
      >
        {text}
      </div>
      <div className="flex items-center gap-1 mt-0.5 opacity-60">
        <span className="text-[11px]">{formatTimeFull(ts)}</span>
        {optimistic ? (
          <Loader2 size={8} className="animate-spin text-[#3390ec]" />
        ) : (
          <Check size={8} className="text-[#3390ec]" />
        )}
      </div>
    </div>
  );
}
