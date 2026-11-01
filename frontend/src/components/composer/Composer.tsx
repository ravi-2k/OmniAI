import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { ArrowUp, Mic, Paperclip, Square } from "lucide-react";

import { getAgent, toBackendAgent, type AgentId } from "@/config/agents";
import { LIMITS } from "@/config/env";
import { useChatSession } from "@/contexts/ChatSessionContext";
import { useToast } from "@/contexts/ToastContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAutoResize, useIsMobile } from "@/hooks/utility";
import { acceptAttribute, validateFile } from "@/utils/files";
import { cn } from "@/utils/cn";
import { IconButton } from "@/components/ui/Button";
import { AgentSelector } from "./AgentSelector";
import { AttachmentChip } from "./AttachmentChip";
import { VoiceBar } from "./VoiceBar";

export interface Prefill {
  text: string;
  nonce: number;
}

interface ComposerProps {
  conversationId?: string;
  agent: AgentId;
  onAgentChange: (agent: AgentId) => void;
  /** The conversation already contains an uploaded PDF the user can ask about. */
  hasConversationPdf: boolean;
  prefill?: Prefill | null;
}

const join = (base: string, spoken: string) => [base.trimEnd(), spoken].filter(Boolean).join(base.trimEnd() ? " " : "");

export function Composer({ conversationId, agent, onAgentChange, hasConversationPdf, prefill }: ComposerProps) {
  const toast = useToast();
  const isMobile = useIsMobile();
  const { send, cancel, pendingFor, isBusy, creating } = useChatSession();
  const voice = useSpeechRecognition();

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askAboutPdf, setAskAboutPdf] = useState(true);
  const [dragging, setDragging] = useState(false);

  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const voiceBase = useRef("");
  const voiceActive = useRef(false);

  const def = getAgent(agent);
  const busy = isBusy(conversationId);
  const canAttach = def.accepts !== "none";
  const overLimit = text.length > LIMITS.promptMaxLength;
  const fileDriven = !!file && (agent === "auto" || agent === "pdf" || agent === "vision");
  const canSend = !busy && !creating && !voice.listening && !overLimit && (text.trim().length > 0 || fileDriven);

  useAutoResize(textarea, text);

  // Focus the box on desktop when switching chats (on mobile it would pop the keyboard).
  useEffect(() => {
    if (!isMobile) textarea.current?.focus();
  }, [conversationId, isMobile]);

  // Suggestions from the empty state fill the composer. (Adjusting state while
  // rendering is React's recommended way to react to a changed prop.)
  const [seenPrefill, setSeenPrefill] = useState(prefill);
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill) {
      setText(prefill.text);
      setFile(null);
      setError(null);
    }
  }
  useEffect(() => {
    if (prefill) textarea.current?.focus();
  }, [prefill]);

  // Speech -> text, appended to whatever was typed before recording started.
  useEffect(() => {
    if (voiceActive.current) setText(join(voiceBase.current, voice.transcript));
  }, [voice.transcript]);

  useEffect(() => {
    if (!voice.listening) voiceActive.current = false;
  }, [voice.listening]);

  const [seenVoiceError, setSeenVoiceError] = useState<string | null>(null);
  if (voice.error !== seenVoiceError) {
    setSeenVoiceError(voice.error);
    if (voice.error) setError(voice.error);
  }

  const attach = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      const problem = validateFile(candidate, def.accepts);
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      setFile(candidate);
    },
    [def.accepts],
  );

  const changeAgent = (next: AgentId) => {
    onAgentChange(next);
    setError(null);
    if (file && validateFile(file, getAgent(next).accepts)) {
      setFile(null);
      toast({
        title: "Attachment removed",
        description: `${getAgent(next).label} can't use that file.`,
      });
    }
  };

  const submit = async () => {
    if (!canSend || submitting.current) return;
    submitting.current = true;
    try {
      const accepted = await send({
        conversationId: conversationId ?? null,
        prompt: text.trim(),
        agent,
        backendAgent: toBackendAgent(agent, { hasFile: !!file, askAboutPdf }),
        file: file ?? undefined,
      });
      if (accepted) {
        setText("");
        setFile(null);
        setError(null);
      }
    } finally {
      submitting.current = false;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(event.clipboardData.files)[0];
    if (pasted && canAttach) {
      event.preventDefault();
      attach(pasted);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!canAttach) {
      setError(`${def.label} doesn't use attachments.`);
      return;
    }
    attach(event.dataTransfer.files[0]);
  };

  const startVoice = () => {
    voiceBase.current = text;
    voiceActive.current = true;
    voice.start();
  };

  const cancelVoice = () => {
    voiceActive.current = false;
    voice.cancel();
    setText(voiceBase.current);
  };

  const stopGenerating = () => {
    const working = pendingFor(conversationId).find((item) => item.status === "working");
    if (working) cancel(working.id);
  };

  const showPdfToggle = agent === "pdf" && !file && hasConversationPdf;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6">
      {voice.listening && (
        <VoiceBar elapsed={voice.elapsed} onCancel={cancelVoice} onDone={voice.stop} />
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging}
        className="composer-box rounded-[1.75rem] px-3 pb-3 pt-1.5 data-[dragging=true]:!border-accent data-[dragging=true]:!bg-accent-soft"
      >
        {file && (
          <div className="px-1 pb-2 pt-1">
            <AttachmentChip file={file} onRemove={() => setFile(null)} />
          </div>
        )}

        <label htmlFor="composer-input" className="sr-only">
          Message OmniAI
        </label>
        <textarea
          id="composer-input"
          ref={textarea}
          value={text}
          rows={1}
          // Grammarly's floating badge crowds the compact field; opt this input out.
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          readOnly={voice.listening}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={
            file && agent === "pdf"
              ? "Ask a question about this PDF…"
              : file && agent === "vision"
                ? "Ask about this image…"
                : def.placeholder
          }
          className="block max-h-[240px] w-full resize-none bg-transparent px-3.5 pb-3 pt-0 text-[15.5px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
        />

        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            hidden
            accept={acceptAttribute(def.accepts)}
            onChange={(event) => {
              attach(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <IconButton
            label={canAttach ? "Attach a file" : `${def.label} doesn't use attachments`}
            size="sm"
            tooltipSide="top"
            disabled={!canAttach || busy}
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip className="size-4" />
          </IconButton>

          <AgentSelector value={agent} onChange={changeAgent} disabled={busy} />

          {showPdfToggle && (
            <button
              type="button"
              onClick={() => setAskAboutPdf((current) => !current)}
              aria-pressed={askAboutPdf}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                askAboutPdf
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:bg-surface-2",
              )}
            >
              {askAboutPdf ? "Asking about the PDF in this chat" : "Creating a new PDF"}
            </button>
          )}

          <span className="flex-1" />

          {text.length > LIMITS.promptMaxLength * 0.8 && (
            <span className={cn("mr-1 text-xs tabular-nums", overLimit ? "text-danger" : "text-fg-subtle")}>
              {text.length}/{LIMITS.promptMaxLength}
            </span>
          )}

          <IconButton
            label={
              !voice.supported
                ? "Voice input isn't supported in this browser"
                : voice.listening
                  ? "Stop recording"
                  : "Voice input"
            }
            size="sm"
            tooltipSide="top"
            disabled={!voice.supported || busy}
            onClick={voice.listening ? voice.stop : startVoice}
            className={cn(voice.listening && "bg-danger-soft text-danger")}
          >
            <Mic className="size-4" />
          </IconButton>

          {busy ? (
            <IconButton label="Stop generating" variant="primary" size="sm" tooltipSide="top" className="rounded-full" onClick={stopGenerating}>
              <Square className="size-3.5 fill-current" />
            </IconButton>
          ) : (
            <IconButton
              label="Send message"
              variant="primary"
              size="sm"
              tooltipSide="top"
              className="rounded-full"
              disabled={!canSend}
              onClick={() => void submit()}
            >
              <ArrowUp className="size-4" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="mt-1.5 min-h-5 px-1 text-center">
        {error ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : (
          <p className="text-xs text-fg-subtle">OmniAI can make mistakes. Please verify important information. · Deployed via CI/CD</p>
        )}
      </div>
    </div>
  );
}
