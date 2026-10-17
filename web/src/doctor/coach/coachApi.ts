// Calls the F10 server routes (PLAN.md §16) and falls back to the client template on any failure.
import type { BuzzSensitivity } from '../../live/types';
import type { CoachContext } from './context';
import { templateNote, templateVoice } from './templateCoach';

const API: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TIMEOUT_MS = 6000;

export type CoachSource = 'gemini' | 'template';
export interface CoachNote { text: string; source: CoachSource }
export interface VoiceReply { reply: string; buzzSensitivity: BuzzSensitivity | null; source: CoachSource }

/** POST JSON with a 6 s abort timeout and return the parsed body; throws on any failure. */
async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Ask the server for a coach note; template text when there is no data or the call fails. */
export async function fetchCoachNote(ctx: CoachContext): Promise<CoachNote> {
  if (ctx.sampleCount === 0) return { text: templateNote(ctx), source: 'template' };
  try {
    const data = await post<CoachNote>('/coach', { context: ctx });
    if (typeof data.text !== 'string' || !data.text) throw new Error('empty note');
    return { text: data.text, source: data.source === 'gemini' ? 'gemini' : 'template' };
  } catch {
    return { text: templateNote(ctx), source: 'template' };
  }
}

/** Send a spoken instruction to the server; keyword template when the call fails. */
export async function sendVoice(transcript: string, ctx: CoachContext): Promise<VoiceReply> {
  try {
    const data = await post<VoiceReply>('/coach/voice', { transcript, context: ctx });
    if (typeof data.reply !== 'string' || !data.reply) throw new Error('empty reply');
    const level = data.buzzSensitivity === 'low' || data.buzzSensitivity === 'medium' || data.buzzSensitivity === 'high' ? data.buzzSensitivity : null;
    return { reply: data.reply, buzzSensitivity: level, source: data.source === 'gemini' ? 'gemini' : 'template' };
  } catch {
    return { ...templateVoice(transcript), source: 'template' };
  }
}
