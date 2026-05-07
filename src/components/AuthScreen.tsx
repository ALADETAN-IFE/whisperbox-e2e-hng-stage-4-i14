"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Eye, EyeOff } from "lucide-react";
import { useAppState } from "@/hooks/useAppState";
import { showToast } from "./Toast";
import KeySetupOverlay, { KEY_STEPS, type StepStatus } from "./KeySetupOverlay";
import {
  generateRSAKeyPair,
  exportKey,
  importPublicKey,
  deriveWrappingKey,
  wrapPrivateKey,
} from "@/lib/crypto";
import { openKeyDB, savePrivateKey, loadPrivateKey } from "@/lib/db";
import type { User } from "@/types";

type Tab = "login" | "register";

type KeyStepState = {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: StepStatus;
}[];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function AuthScreen() {
  const { dispatch } = useAppState();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [keySteps, setKeySteps] = useState<KeyStepState | null>(null);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regDisplay, setRegDisplay] = useState("");
  const [regPassword, setRegPassword] = useState("");

  function stepState(active: number): KeyStepState {
    return KEY_STEPS.map((s, i) => ({
      ...s,
      status: i < active ? "done" : i === active ? "active" : "idle",
    }));
  }

  async function setupNewKeys(username: string, password: string) {
    setKeySteps(stepState(0));
    await sleep(400);
    const keyPair = await generateRSAKeyPair();
    setKeySteps(stepState(1));

    await sleep(300);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = btoa(String.fromCharCode(...salt));
    const wrappingKey = await deriveWrappingKey(password, saltB64);
    const wrappedPrivateKey = await wrapPrivateKey(
      keyPair.privateKey,
      wrappingKey,
    );
    setKeySteps(stepState(2));

    await sleep(300);
    const db = await openKeyDB();
    dispatch({ type: "SET_DB", db });
    await savePrivateKey(db, username, keyPair.privateKey);

    setKeySteps(KEY_STEPS.map((s) => ({ ...s, status: "done" as StepStatus })));
    await sleep(600);
    setKeySteps(null);

    return { keyPair, wrappedPrivateKey, saltB64 };
  }

  async function handleLogin() {
    if (!loginUsername || !loginPassword) {
      showToast("Fill in all fields", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail || data.message || "Login failed");

      const user: User = { id: data.user_id, username: loginUsername };
      dispatch({ type: "SET_USER", user });
      sessionStorage.setItem("wb_user", loginUsername);

      await afterLogin(user, loginPassword);
      router.push("/chat");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!regUsername || !regDisplay || !regPassword) {
      showToast("Fill in all fields", "error");
      return;
    }
    if (regPassword.length < 8) {
      showToast("Password must be 8+ characters", "error");
      return;
    }
    setLoading(true);
    try {
      const { keyPair, wrappedPrivateKey, saltB64 } = await setupNewKeys(
        regUsername,
        regPassword,
      );
      const pubKeyB64 = await exportKey(keyPair.publicKey, "spki");

      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          display_name: regDisplay,
          password: regPassword,
          public_key: pubKeyB64,
          wrapped_private_key: wrappedPrivateKey,
          pbkdf2_salt: saltB64,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok)
        throw new Error(
          regData.detail || regData.message || "Registration failed",
        );

      await sleep(500);

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, password: regPassword }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok)
        throw new Error(loginData.detail || "Login after register failed");

      const user: User = { id: loginData.user_id, username: regUsername };
      dispatch({ type: "SET_USER", user });
      sessionStorage.setItem("wb_user", regUsername);
      await afterLogin(user, regPassword);
      router.push("/chat");
    } catch (e) {
      showToast((e as Error).message, "error");
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  async function afterLogin(user: User, password: string) {
    try {
      const res = await fetch(
        `/api/proxy?path=${encodeURIComponent("/auth/me")}`,
      );
      const me = (await res.json()) as User;
      const fullUser: User = {
        ...user,
        ...me,
        id: me.id || me.user_id || user.id,
      };
      dispatch({ type: "SET_USER", user: fullUser });

      const db = await openKeyDB();
      dispatch({ type: "SET_DB", db });

      let privateKey = await loadPrivateKey(db, fullUser.username);
      let publicKey: CryptoKey | null = null;

      if (privateKey) {
        if (fullUser.public_key) {
          try {
            publicKey = await importPublicKey(fullUser.public_key);
          } catch {}
        }
      } else if (fullUser.wrapped_private_key && fullUser.pbkdf2_salt) {
        const { unwrapPrivateKey, deriveWrappingKey: dwk } =
          await import("@/lib/crypto");
        const wrappingKey = await dwk(password, fullUser.pbkdf2_salt);
        privateKey = await unwrapPrivateKey(
          fullUser.wrapped_private_key,
          wrappingKey,
        );
        await savePrivateKey(db, fullUser.username, privateKey);
        if (fullUser.public_key) {
          try {
            publicKey = await importPublicKey(fullUser.public_key);
          } catch {}
        }
      } else {
        const { keyPair, wrappedPrivateKey, saltB64 } = await setupNewKeys(
          fullUser.username,
          password,
        );
        privateKey = keyPair.privateKey;
        publicKey = keyPair.publicKey;
        const pubKeyB64 = await exportKey(publicKey, "spki");
        await fetch(
          `/api/proxy?path=${encodeURIComponent("/users/me/public-key")}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              public_key: pubKeyB64,
              wrapped_private_key: wrappedPrivateKey,
              pbkdf2_salt: saltB64,
            }),
          },
        ).catch(() => {});
      }

      dispatch({ type: "SET_KEYS", privateKey, publicKey });
    } catch (e) {
      console.error("afterLogin failed:", e);
    }
  }

  return (
    <>
      {keySteps && <KeySetupOverlay steps={keySteps} />}

      <div className="fixed inset-0 flex items-center justify-center bg-[#0f0f0f] z-100">
        <div className="w-90 px-5 py-10 text-center">
          <div className="mb-10">
            <div className="w-20 h-20 bg-[#3390ec] rounded-[20px] flex items-center justify-center mx-auto mb-4">
              <Send size={40} className="text-white" />
            </div>
            <span className="text-2xl font-bold">WhisperBox</span>
          </div>

          <div className="flex gap-2 justify-center mb-8">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                  ${tab === t ? "bg-[#3390ec]/10 text-[#3390ec]" : "text-[#3390ec]/60"}`}
              >
                {t === "login" ? "Log In" : "Register"}
              </button>
            ))}
          </div>

          {tab === "login" && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full bg-[#212121] border border-white/8 rounded-xl px-4 py-3 text-white text-[15px] outline-none focus:border-[#3390ec]"
                autoComplete="username"
              />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full bg-[#212121] border border-white/8 rounded-xl px-4 py-3 pr-12 text-white text-[15px] outline-none focus:border-[#3390ec]"
                  autoComplete="current-password"
                />
                <button
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707579]"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full py-3.5 bg-[#3390ec] hover:bg-[#2b78c7] disabled:opacity-50 text-white rounded-xl font-semibold text-sm mt-2 transition-colors"
              >
                {loading ? "Signing in…" : "LOGIN"}
              </button>
            </div>
          )}

          {tab === "register" && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full bg-[#212121] border border-white/8 rounded-xl px-4 py-3 text-white text-[15px] outline-none focus:border-[#3390ec]"
                autoComplete="username"
              />
              <input
                type="text"
                placeholder="Display Name (e.g. John Doe)"
                value={regDisplay}
                onChange={(e) => setRegDisplay(e.target.value)}
                className="w-full bg-[#212121] border border-white/8 rounded-xl px-4 py-3 text-white text-[15px] outline-none focus:border-[#3390ec]"
              />
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password (min 8 chars)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#212121] border border-white/8 rounded-xl px-4 py-3 pr-12 text-white text-[15px] outline-none focus:border-[#3390ec]"
                  autoComplete="new-password"
                />
                <button
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#707579]"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-3.5 bg-[#3390ec] hover:bg-[#2b78c7] disabled:opacity-50 text-white rounded-xl font-semibold text-sm mt-2 transition-colors"
              >
                {loading ? "Creating account…" : "CREATE ACCOUNT"}
              </button>
            </div>
          )}

          <p className="mt-8 text-sm text-[#707579]">
            Your messages are end-to-end encrypted.
          </p>
        </div>
      </div>
    </>
  );
}
