// The doctor's voice-instruction flow: listen, edit the transcript, send it to Gemini, show the reply, finish.
import { useEffect, useRef, useState } from 'react';
import { sendVoice, type CoachSource } from '../../doctor/coach/coachApi';
import { buildCoachContext } from '../../doctor/coach/context';
import { isSpeechSupported, startRecognition } from '../../doctor/coach/speech';
import { setBuzz } from '../../live/actions';
import type { BuzzSensitivity } from '../../live/types';

export type VoicePhase = 'idle' | 'listening' | 'editing' | 'thinking' | 'reply';
export interface VoiceReply { text: string; source: CoachSource; buzz: BuzzSensitivity | null }

export interface VoiceNote {
  phase: VoicePhase;
  text: string;
  setText: (text: string) => void;
  reply: VoiceReply | null;
  supported: boolean;
  blocked: boolean;
  toggleMic: () => void;      // start or stop listening; without speech support, opens an empty editable box instead
  submit: () => void;         // the first check mark: send the (edited) text to Gemini
  finish: () => void;         // the second check mark, or the discard button: back to idle
}

/** State machine behind the transcript box and the mic card. */
export function useVoiceNote(): VoiceNote {
  const [supported] = useState(isSpeechSupported);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [text, setText] = useState('');
  const [reply, setReply] = useState<VoiceReply | null>(null);
  const [blocked, setBlocked] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const finalRef = useRef('');
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopRef.current?.();
    };
  }, []);

  /** Start one utterance: interim words stream into `text`, and listening ending opens the editable box (or returns to idle when nothing was heard). */
  const listen = () => {
    finalRef.current = '';
    setText('');
    setReply(null);
    setBlocked(false);
    setPhase('listening');
    const session = startRecognition({
      onInterim: (t) => setText(`${finalRef.current} ${t}`.trim()),
      onFinal: (t) => {
        finalRef.current = `${finalRef.current} ${t}`.trim();
        setText(finalRef.current);
      },
      onError: (code) => setBlocked(code === 'not-allowed' || code === 'service-not-allowed'),
      onEnd: () => {
        stopRef.current = null;
        if (!aliveRef.current) return;
        const heard = finalRef.current.trim();
        setText(heard);
        setPhase(heard ? 'editing' : 'idle');
      },
    });
    stopRef.current = session.stop;
  };

  const toggleMic = () => {
    if (phase === 'listening') stopRef.current?.();
    else if (phase !== 'idle') return;
    else if (supported && !blocked) listen();
    else {
      setText('');
      setReply(null);
      setPhase('editing');
    }
  };

  const submit = () => {
    const line = text.trim();
    if (!line || phase !== 'editing') return;
    setPhase('thinking');
    void sendVoice(line, buildCoachContext()).then((res) => {
      if (!aliveRef.current) return;
      // STUB(S3): buzz sensitivity drives V,<motor>,<pattern> once S3 merges
      if (res.buzzSensitivity) setBuzz(res.buzzSensitivity);
      setReply({ text: res.reply, source: res.source, buzz: res.buzzSensitivity });
      setPhase('reply');
    });
  };

  const finish = () => {
    if (phase === 'editing' || phase === 'reply') setPhase('idle');
  };

  return { phase, text, setText, reply, supported, blocked, toggleMic, submit, finish };
}
