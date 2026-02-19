"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, Send, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "./useVoiceInput";
import { ScribbsIcon } from "./ScribbsIcon";
import { REFRESH_OBJECTS_EVENT } from "@/components/canvas/hooks/useBoardObjectsSync";

type Props = {
  boardId: string;
  className?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  isPlaceholder?: boolean;
};

const BOT_NAME = "Scribbs";

const PLACEHOLDER_PHRASES = [
  "Thinking…",
  "Pondering…",
  "This shouldn't be that difficult…",
  "Consulting the board…",
  "Almost there…",
  "Working on it…",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: `Hi! I'm ${BOT_NAME}, your board assistant. Ask me what I can do, or give me a command.`,
};

function useAnimatedDots(active: boolean) {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, [active]);
  return dots;
}

export function AIChatFloating({ boardId, className }: Props) {
  const [open, setOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [WELCOME_MESSAGE]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingDots = useAnimatedDots(loading);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length) scrollToBottom();
  }, [messages, scrollToBottom]);

  const submitCommand = useCallback(
    async (trimmed: string) => {
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLoading(true);

      const hasRealContentRef = { current: false };
      const CHAR_DELAY_MS = 90;
      const PHRASE_PAUSE_MS = 3000;

      const runPlaceholderTyping = () => {
        let phraseIndex = 0;
        let charIndex = 0;

        const tick = () => {
          if (hasRealContentRef.current) return;
          const phrase = PLACEHOLDER_PHRASES[phraseIndex % PLACEHOLDER_PHRASES.length];
          if (charIndex < phrase.length) {
            const next = phrase.slice(0, charIndex + 1);
            charIndex += 1;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: next, isPlaceholder: true } : m))
            );
            setTimeout(tick, CHAR_DELAY_MS);
            return;
          }
          phraseIndex += 1;
          charIndex = 0;
          setTimeout(tick, PHRASE_PAUSE_MS);
        };
        tick();
      };
      runPlaceholderTyping();

      const clearPlaceholder = () => {
        hasRealContentRef.current = true;
      };

      const refreshObjects = () => {
        window.dispatchEvent(new CustomEvent(REFRESH_OBJECTS_EVENT, { detail: { boardId } }));
      };
      const pollInterval = setInterval(refreshObjects, 600);

      try {
        const messagesForApi = messages
          .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
        messagesForApi.push({ role: "user", content: trimmed });

        const res = await fetch("/api/ai/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, messages: messagesForApi }),
        });

        if (!res.ok) {
          clearPlaceholder();
          const data = await res.json().catch(() => ({}));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: data.error ?? `Request failed (${res.status})`, error: true, isPlaceholder: false }
                : m
            )
          );
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let text = "";
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            if (text) hasRealContentRef.current = true;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: text, isPlaceholder: false } : m))
            );
          }
        }
        const final = text.trim() || "Done.";
        if (text !== final) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: final, isPlaceholder: false } : m))
          );
        }
        refreshObjects();
      } catch (err) {
        clearPlaceholder();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: err instanceof Error ? err.message : "Network error", error: true, isPlaceholder: false }
              : m
          )
        );
      } finally {
        clearInterval(pollInterval);
        refreshObjects();
        clearPlaceholder();
        setLoading(false);
      }
    },
    [boardId, loading]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = command.trim();
      if (!trimmed || loading) return;
      submitCommand(trimmed);
      setCommand("");
    },
    [command, loading, submitCommand]
  );

  const voice = useVoiceInput({
    onTranscript: (transcript) => {
      submitCommand(transcript);
      setCommand("");
    },
    disabled: loading,
  });

  useEffect(() => {
    if (voice.state === "listening") setOpen(true);
  }, [voice.state]);

  const displayCommand =
    voice.state === "listening" && voice.liveTranscript
      ? voice.liveTranscript
      : command;

  return (
    <div className={cn("fixed bottom-6 right-6 z-40 flex flex-col items-end gap-0", className)}>
      {open && (
        <div
          className="mb-2 flex w-[360px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ maxHeight: "min(480px, 60vh)" }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-medium text-slate-700">{BOT_NAME}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-3">
              {messages.map((m, idx) => {
                const isStreamingAssistant = loading && m.role === "assistant" && idx === messages.length - 1;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm min-h-[2.25rem]",
                      m.role === "user"
                        ? "ml-8 bg-blue-600 text-white"
                        : m.error
                          ? "mr-4 bg-red-50 text-red-700"
                          : m.isPlaceholder
                            ? "mr-4 bg-slate-50 text-slate-400"
                            : "mr-4 bg-slate-100 text-slate-800"
                    )}
                  >
                    <p className="whitespace-pre-wrap">
                      {m.content}
                      {isStreamingAssistant && loadingDots}
                    </p>
                  </div>
                );
              })}
            </div>
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 gap-2 border-t border-slate-200 p-3"
          >
            <textarea
              value={displayCommand}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Type or hold Space to talk..."
              disabled={loading || voice.state === "listening"}
              rows={2}
              className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50"
            />
            {voice.isSupported ? (
              <button
                type="button"
                onPointerDown={voice.handleMicPointerDown}
                onPointerUp={voice.handleMicPointerUp}
                onPointerLeave={voice.handleMicPointerLeave}
                onClick={voice.handleMicClick}
                disabled={loading}
                className={cn(
                  "shrink-0 rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-50",
                  voice.state === "listening"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                aria-label={voice.state === "listening" ? "Listening… release to send" : "Hold to talk, or click for silence detection"}
                title="Hold Space or mic to talk. Release to send."
              >
                <Mic className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="submit"
              disabled={loading || !command.trim()}
              className="shrink-0 rounded-lg bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-1 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label={open ? "Close AI chat" : "Open AI chat"}
      >
        <ScribbsIcon className="h-10 w-10" mouthOpen={open} />
      </button>
    </div>
  );
}
