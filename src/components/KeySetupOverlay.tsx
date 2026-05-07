'use client';

import { Key, Lock, HardDrive, CheckCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export type StepStatus = 'idle' | 'active' | 'done';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  icon: ReactNode;
}

interface KeySetupOverlayProps {
  steps: Step[];
}

export const KEY_STEPS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'rsa',   label: 'Generating RSA-OAEP 2048-bit pair',      icon: <Key size={16} /> },
  { id: 'wrap',  label: 'Wrapping private key for secure backup',  icon: <Lock size={16} /> },
  { id: 'store', label: 'Saving keys to local storage',            icon: <HardDrive size={16} /> },
];

export default function KeySetupOverlay({ steps }: KeySetupOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-20">
      <div className="w-80 text-center p-8">
        <div className="text-5xl text-[#3390ec] mb-5 flex justify-center">
          <Lock size={48} />
        </div>
        <div className="text-xl font-semibold mb-2">Securing Your Space</div>
        <div className="text-sm text-[#aaa] mb-6">Generating unique cryptographic keys...</div>
        <div className="text-left space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 text-sm p-2 rounded-lg transition-colors
                ${step.status === 'active' ? 'text-white bg-white/5' : ''}
                ${step.status === 'done'   ? 'text-[#3390ec]'         : ''}
                ${step.status === 'idle'   ? 'text-[#707579]'         : ''}
              `}
            >
              <span className="shrink-0">{step.icon}</span>
              <span className="flex-1">{step.label}</span>
              {step.status === 'active' && <Loader2 size={14} className="animate-spin shrink-0" />}
              {step.status === 'done'   && <CheckCircle size={14} className="shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
