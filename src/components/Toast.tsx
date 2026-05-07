'use client';

import { useEffect, useState, useCallback } from 'react';

type ToastType = 'default' | 'error' | 'success';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

let _showToast: ((text: string, type?: ToastType) => void) | null = null;

export function showToast(text: string, type: ToastType = 'default') {
  _showToast?.(text, type);
}

export function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastType = 'default') => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    _showToast = addToast;
    return () => { _showToast = null; };
  }, [addToast]);

  if (!messages.length) return null;

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 items-center">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`px-5 py-2.5 rounded-full text-sm text-white font-medium shadow-lg animate-slide-down
            ${m.type === 'error' ? 'bg-red-600' : m.type === 'success' ? 'bg-green-600' : 'bg-[#333]'}`}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}