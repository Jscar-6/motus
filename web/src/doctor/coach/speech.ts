// Thin wrapper over the Web Speech API (Chrome/Edge/Safari). Types are declared locally because lib.dom omits them.

interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

export interface SpeechHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
  onEnd: () => void;
}

/** The browser's SpeechRecognition constructor, if it has one. */
function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** True when this browser can do speech recognition. */
export function isSpeechSupported(): boolean {
  return ctor() !== undefined;
}

/** Start one utterance of recognition; returns a stop function. */
export function startRecognition(handlers: SpeechHandlers): { stop(): void } {
  const Recognition = ctor();
  if (!Recognition) {
    handlers.onError('unsupported');
    handlers.onEnd();
    return { stop() {} };
  }
  const rec = new Recognition();
  rec.lang = 'en-US';
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim) handlers.onInterim(interim.trim());
    if (final.trim()) handlers.onFinal(final.trim());
  };
  rec.onerror = (e) => handlers.onError(e.error);
  rec.onend = handlers.onEnd;
  rec.start();
  return { stop: () => rec.stop() };
}
