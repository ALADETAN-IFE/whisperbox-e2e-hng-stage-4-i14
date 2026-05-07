'use client';

import React, { createContext, useContext, useReducer, useRef, type Dispatch } from 'react';
import type { AppState, Conversation, User } from '@/types';

type Action =
  | { type: 'SET_USER'; user: User | null }
  | { type: 'SET_KEYS'; privateKey: CryptoKey | null; publicKey: CryptoKey | null }
  | { type: 'SET_DB'; db: IDBDatabase | null }
  | { type: 'SET_CONVERSATIONS'; conversations: Conversation[] }
  | { type: 'SET_ACTIVE_CONVO'; peerId: string | null; peer: Conversation | null }
  | { type: 'SET_PRESENCE'; userId: string; online?: boolean; last_seen?: string | null }
  | { type: 'SET_PREVIEW'; peerId: string; preview: string }
  | { type: 'LOGOUT' };

const initialState: AppState = {
  token: null,
  user: null,
  privateKey: null,
  publicKey: null,
  conversations: [],
  activeConvoId: null,
  activePeer: null,
  messagePreviewCache: {},
  db: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'SET_KEYS':
      return { ...state, privateKey: action.privateKey, publicKey: action.publicKey };
    case 'SET_DB':
      return { ...state, db: action.db };
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.conversations };
    case 'SET_ACTIVE_CONVO':
      return { ...state, activeConvoId: action.peerId, activePeer: action.peer };
    case 'SET_PRESENCE': {
      const { userId, online, last_seen } = action;

      const conversations = state.conversations.map((c): Conversation => {
        if (c.user_id !== userId) return c;
        return {
          ...c,
          online,
          last_message_at: last_seen ?? c.last_message_at,
        };
      });

      const activePeer: Conversation | null =
        state.activeConvoId === userId && state.activePeer
          ? {
              ...state.activePeer,
              online,
              last_message_at: last_seen ?? state.activePeer.last_message_at,
            }
          : state.activePeer;

      return { ...state, conversations, activePeer };
    }
    case 'SET_PREVIEW':
      return {
        ...state,
        messagePreviewCache: { ...state.messagePreviewCache, [action.peerId]: action.preview },
      };
    case 'LOGOUT':
      return { ...initialState, db: state.db };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  return (
    <AppContext.Provider value={{ state, dispatch, pollRef }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
