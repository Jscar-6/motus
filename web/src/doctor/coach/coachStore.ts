// Coach panel state: message log, mic state and in-flight request count.
import { create } from 'zustand';
import type { CoachSource } from './coachApi';

const MAX_MESSAGES = 20;

export interface CoachMessage {
  id: string;
  role: 'coach' | 'therapist';
  text: string;
  source: CoachSource | 'voice';   // 'voice' marks the therapist's own spoken line
  t: number;
}

interface CoachState {
  messages: CoachMessage[];        // oldest first, capped
  listening: boolean;
  interim: string;                 // live transcript while the mic is open
  pending: number;                 // requests in flight (notes and voice)
  push: (role: CoachMessage['role'], text: string, source: CoachMessage['source']) => void;
  setListening: (listening: boolean) => void;
  setInterim: (interim: string) => void;
  beginPending: () => void;
  endPending: () => void;
}

let nextId = 0;

export const useCoachStore = create<CoachState>((set) => ({
  messages: [],
  listening: false,
  interim: '',
  pending: 0,
  push: (role, text, source) =>
    set((s) => ({ messages: [...s.messages, { id: `m${nextId++}`, role, text, source, t: Date.now() }].slice(-MAX_MESSAGES) })),
  setListening: (listening) => set({ listening }),
  setInterim: (interim) => set({ interim }),
  beginPending: () => set((s) => ({ pending: s.pending + 1 })),
  endPending: () => set((s) => ({ pending: Math.max(0, s.pending - 1) })),
}));
