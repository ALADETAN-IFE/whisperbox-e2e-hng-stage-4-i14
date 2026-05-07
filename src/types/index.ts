export interface User {
  id: string | null;
  user_id?: string;
  username: string;
  display_name?: string;
  public_key?: string;
  wrapped_private_key?: string;
  pbkdf2_salt?: string;
}

export interface Conversation {
  id?: string;
  user_id: string;
  username?: string;
  display_name?: string;
  last_message_at?: string;
  public_key?: string;
  // Presence fields from API / WebSocket
  online?: boolean;
  last_seen?: string;
  last_active?: string;
}

export interface MessagePayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf?: string | null;
}

export interface Message {
  id?: string;
  sender_id?: string;
  sender?: { id: string };
  from_user_id?: string;
  created_at?: string;
  timestamp?: string;
  payload?: MessagePayload | string;
  encrypted_payload?: MessagePayload | string;
  content?: string;
  text?: string;
}

export interface KeySetupStep {
  id: string;
  label: string;
  status: "idle" | "active" | "done";
}

export interface AppState {
  token: string | null;
  user: User | null;
  privateKey: CryptoKey | null;
  publicKey: CryptoKey | null;
  conversations: Conversation[];
  activeConvoId: string | null;
  activePeer: Conversation | null;
  messagePreviewCache: Record<string, string>;
  db: IDBDatabase | null;
}

// Extend User with presence field used in Sidebar footer
export interface AuthenticatedUser extends User {
  online?: boolean;
}
