"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const SILENCE_TIMEOUT_MS = 1000;
const HOLD_THRESHOLD_MS = 300;
/** Hold space for this long before space-to-talk activates. */
const SPACE_HOLD_TO_ACTIVATE_MS = 1000;

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

export type VoiceState = "idle" | "listening";

function isEditableElement(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    el.getAttribute?.("contenteditable") === "true"
  );
}

export function useVoiceInput(options: {
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
}) {
  const { onTranscript, disabled } = options;
  const [state, setState] = useState<VoiceState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const pointerDownTimeRef = useRef<number>(0);
  const isHoldModeRef = useRef(false);
  const justSwitchedToClickModeRef = useRef(false);
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const finishAndSubmit = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    clearSilenceTimer();
    setState("idle");
    setInterimTranscript("");
    setLiveTranscript("");
    const transcript = finalTranscriptRef.current.trim();
    finalTranscriptRef.current = "";
    if (transcript.length > 0) {
      onTranscript(transcript);
    }
  }, [onTranscript, clearSilenceTimer]);

  const startSilenceTimeout = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      finishAndSubmit();
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer, finishAndSubmit]);

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new Recognition!();
    recognitionRef.current = rec;
    finalTranscriptRef.current = "";
    isHoldModeRef.current = false;

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result.length > 0 ? result[0].transcript : "";
        if (result.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
        if (!isHoldModeRef.current) {
          startSilenceTimeout();
        }
      }
      setInterimTranscript(interim);
      setLiveTranscript(finalTranscriptRef.current + interim);
    };

    rec.onend = () => {
      if (recognitionRef.current === rec) {
        recognitionRef.current = null;
        clearSilenceTimer();
        setState("idle");
        setInterimTranscript("");
        const transcript = finalTranscriptRef.current.trim();
        finalTranscriptRef.current = "";
        if (transcript.length > 0) {
          onTranscript(transcript);
        }
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "aborted") return;
      console.warn("[VoiceInput] Speech recognition error:", e.error);
      finishAndSubmit();
    };

    setState("listening");
    try {
      rec.start();
    } catch (err) {
      console.warn("[VoiceInput] Failed to start:", err);
      setState("idle");
    }
  }, [isSupported, disabled, startSilenceTimeout, clearSilenceTimer, onTranscript, finishAndSubmit]);

  const handleMicPointerDown = useCallback(() => {
    if (!isSupported || disabled) return;
    pointerDownTimeRef.current = Date.now();
    isHoldModeRef.current = true;
    startListening();
  }, [isSupported, disabled, startListening]);

  const handleMicPointerUp = useCallback(() => {
    if (!isSupported || disabled) return;
    const heldFor = Date.now() - pointerDownTimeRef.current;
    if (heldFor >= HOLD_THRESHOLD_MS) {
      finishAndSubmit();
    } else {
      isHoldModeRef.current = false;
      justSwitchedToClickModeRef.current = true;
      startSilenceTimeout();
    }
  }, [isSupported, disabled, finishAndSubmit, startSilenceTimeout]);

  const handleMicPointerLeave = useCallback(() => {
    if (state !== "listening") return;
    const heldFor = Date.now() - pointerDownTimeRef.current;
    if (heldFor >= HOLD_THRESHOLD_MS) {
      finishAndSubmit();
    }
  }, [state, finishAndSubmit]);

  const handleMicClick = useCallback(() => {
    if (!isSupported || disabled) return;
    if (justSwitchedToClickModeRef.current) {
      justSwitchedToClickModeRef.current = false;
      return;
    }
    if (state === "listening") {
      finishAndSubmit();
    } else {
      isHoldModeRef.current = false;
      startListening();
      startSilenceTimeout();
    }
  }, [isSupported, disabled, state, startListening, finishAndSubmit, startSilenceTimeout]);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
      clearSilenceTimer();
    };
  }, [clearSilenceTimer]);

  useEffect(() => {
    const clearSpaceHoldTimer = () => {
      if (spaceHoldTimerRef.current) {
        clearTimeout(spaceHoldTimerRef.current);
        spaceHoldTimerRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || disabled || !isSupported) return;
      if (isEditableElement(e.target as HTMLElement)) return; // Let space type normally
      if (e.repeat) return; // Ignore key repeat
      if (state === "listening") return; // Already listening
      e.preventDefault();
      clearSpaceHoldTimer();
      pointerDownTimeRef.current = Date.now();
      isHoldModeRef.current = true;
      spaceHoldTimerRef.current = setTimeout(() => {
        spaceHoldTimerRef.current = null;
        startListening();
      }, SPACE_HOLD_TO_ACTIVATE_MS);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || disabled || !isSupported) return;
      if (isEditableElement(e.target as HTMLElement)) return;
      if (e.repeat) return;
      e.preventDefault();
      clearSpaceHoldTimer();
      if (state === "listening") {
        finishAndSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      clearSpaceHoldTimer();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [disabled, isSupported, state, startListening, finishAndSubmit]);

  return {
    isSupported,
    state,
    interimTranscript,
    liveTranscript,
    startListening,
    stopListening: finishAndSubmit,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicPointerLeave,
    handleMicClick,
  };
}
