import { useRouter } from 'next/navigation';
import { handleExpiredSession } from '@/hooks/useAuthRestore';

interface UnlockOverlayProps {
  unlockPassword: string;
  onPasswordChange: (val: string) => void;
  unlockError: string;
  unlocking: boolean;
  onUnlock: () => void;
}

export default function UnlockOverlay({
  unlockPassword,
  onPasswordChange,
  unlockError,
  unlocking,
  onUnlock,
}: UnlockOverlayProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-50">
      <div className="w-80 bg-[#1c1c1c] rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 bg-[#3390ec]/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3390ec" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div className="text-lg font-semibold mb-1">Unlock your keys</div>
        <p className="text-sm text-[#707579] mb-6">Enter your password to restore your encryption keys on this device.</p>
        <input
          type="password"
          placeholder="Your password"
          value={unlockPassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onUnlock()}
          className="w-full bg-[#212121] border border-white/8 rounded-xl px-4 py-3 text-white text-[15px] outline-none focus:border-[#3390ec] mb-3"
          autoFocus
        />
        {unlockError && <p className="text-red-400 text-sm mb-3">{unlockError}</p>}
        <button
          onClick={onUnlock}
          disabled={!unlockPassword || unlocking}
          className="w-full py-3 bg-[#3390ec] hover:bg-[#2b78c7] disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors mb-3"
        >
          {unlocking ? 'Unlocking…' : 'Unlock'}
        </button>
        <button
          onClick={() => handleExpiredSession(router)}
          className="text-sm text-[#707579] hover:text-white transition-colors"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
