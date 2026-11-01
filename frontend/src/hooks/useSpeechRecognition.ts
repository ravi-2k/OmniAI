import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings: the Web Speech API isn't in lib.dom for every browser target.
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings to use voice input.",
  "service-not-allowed": "Microphone access was blocked. Allow it in your browser's site settings to use voice input.",
  "audio-capture": "No microphone was found.",
  "no-speech": "I didn't hear anything. Try again.",
  network: "Voice input needs a network connection.",
};

export function useSpeechRecognition() {
  const supported = !!getCtor();
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<number | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognition.current) return;

    const instance = new Ctor();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";

    instance.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i]![0].transcript;
      }
      setTranscript(text.trim());
    };
    instance.onerror = (event) => {
      setError(ERROR_MESSAGES[event.error] ?? "Voice input stopped unexpectedly.");
    };
    instance.onend = () => {
      recognition.current = null;
      clearTimer();
      setListening(false);
    };

    setError(null);
    setTranscript("");
    setElapsed(0);
    recognition.current = instance;
    try {
      instance.start();
    } catch {
      recognition.current = null;
      setError("Voice input couldn't start. Try again.");
      return;
    }
    setListening(true);
    timer.current = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
  }, []);

  /** Stops and keeps what was heard. */
  const stop = useCallback(() => recognition.current?.stop(), []);

  /** Stops and discards. */
  const cancel = useCallback(() => {
    recognition.current?.abort();
    setTranscript("");
  }, []);

  // Release the microphone and timers if the component goes away mid-recording.
  useEffect(
    () => () => {
      recognition.current?.abort();
      recognition.current = null;
      clearTimer();
    },
    [],
  );

  return { supported, listening, transcript, elapsed, error, start, stop, cancel };
}
