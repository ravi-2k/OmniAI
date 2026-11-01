import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import type { AgentId } from "@/config/agents";
import type { BackendAgent, ChatResponse, Message } from "@/types/api";
import { agentApi, conversationsApi } from "@/services/api/endpoints";
import { ApiError, userMessage } from "@/services/api/errors";
import { appendMessages, keys } from "@/hooks/queries";
import { useArtifacts } from "@/contexts/ArtifactContext";
import { useToast } from "@/contexts/ToastContext";
import { isImage } from "@/utils/files";

export interface PendingSend {
  id: string;
  conversationId: string;
  prompt: string;
  agent: AgentId;
  backendAgent: BackendAgent;
  file?: File;
  /** Object URL for image previews while the upload is in flight. */
  previewUrl?: string;
  status: "working" | "failed";
  /** Upload progress 0-100 while a file is being sent, otherwise null. */
  progress: number | null;
  startedAt: number;
  createdAt: string;
  error?: ApiError;
}

export interface SendInput {
  /** null = start a new conversation (created on first send). */
  conversationId: string | null;
  prompt: string;
  agent: AgentId;
  backendAgent: BackendAgent;
  file?: File;
}

interface ChatSessionValue {
  pendingFor: (conversationId: string | undefined) => PendingSend[];
  isBusy: (conversationId: string | undefined) => boolean;
  /** True while a brand-new conversation is being created. */
  creating: boolean;
  /** Resolves false when nothing was sent (so the composer can keep the user's text). */
  send: (input: SendInput) => Promise<boolean>;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  dismiss: (id: string) => void;
  /** True if this conversation was just created by a first send (so UI state can carry over). */
  isJustCreated: (conversationId: string | undefined) => boolean;
  clearJustCreated: (conversationId: string | undefined) => void;
}

const ChatSessionContext = createContext<ChatSessionValue | null>(null);

let counter = 0;
const newId = () => `pending-${Date.now()}-${counter++}`;

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { openArtifact } = useArtifacts();

  const [pending, setPending] = useState<PendingSend[]>([]);
  const [creating, setCreating] = useState(false);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  const controllers = useRef(new Map<string, AbortController>());
  const justCreated = useRef<string | null>(null);

  const isJustCreated = useCallback(
    (conversationId: string | undefined) => !!conversationId && justCreated.current === conversationId,
    [],
  );
  const clearJustCreated = useCallback((conversationId: string | undefined) => {
    if (conversationId && justCreated.current === conversationId) justCreated.current = null;
  }, []);

  const patch = useCallback((id: string, changes: Partial<PendingSend>) => {
    setPending((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const remove = useCallback((id: string) => {
    setPending((current) => {
      const target = current.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    controllers.current.delete(id);
  }, []);

  const complete = useCallback(
    (item: PendingSend, response: ChatResponse) => {
      // Server messages carry no URLs (they expire); the live response has fresh ones.
      const userMsg: Message = {
        ...response.userMessage,
        attachments: response.attachments?.length
          ? response.attachments
          : response.userMessage.attachments,
      };
      const assistantMsg: Message = {
        ...response.assistantMessage,
        agent: response.agent,
        files: response.files,
        sources: response.sources,
        artifacts: response.artifacts,
        images: response.images,
      };

      appendMessages(client, item.conversationId, [userMsg, assistantMsg]);
      client.invalidateQueries({ queryKey: keys.conversationsAll });
      client.invalidateQueries({ queryKey: keys.conversation(item.conversationId) });
      remove(item.id);

      // Auto-open only for a live response that actually contains artifacts.
      const [artifact] = response.artifacts ?? [];
      if (artifact?.files?.length) openArtifact(item.conversationId, artifact);
    },
    [client, openArtifact, remove],
  );

  const run = useCallback(
    async (item: PendingSend) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      patch(item.id, {
        status: "working",
        error: undefined,
        progress: item.file ? 0 : null,
        startedAt: Date.now(),
      });

      try {
        const response = await agentApi.chat(
          {
            prompt: item.prompt,
            conversationId: item.conversationId,
            agent: item.backendAgent,
            file: item.file,
          },
          {
            signal: controller.signal,
            onUploadProgress: (percent) => patch(item.id, { progress: percent >= 100 ? null : percent }),
          },
        );
        complete(item, response);
      } catch (error) {
        if (error instanceof ApiError && error.code === "ABORTED") {
          // The server may still have finished; reconcile with what it saved.
          remove(item.id);
          client.invalidateQueries({ queryKey: keys.messages(item.conversationId) });
          client.invalidateQueries({ queryKey: keys.conversationsAll });
          return;
        }
        patch(item.id, {
          status: "failed",
          progress: null,
          error:
            error instanceof ApiError ? error : new ApiError(0, "NETWORK_ERROR", "Network error"),
        });
      } finally {
        controllers.current.delete(item.id);
      }
    },
    [client, complete, patch, remove],
  );

  const send = useCallback(
    async (input: SendInput) => {
      let conversationId = input.conversationId;

      if (conversationId && pendingRef.current.some((p) => p.conversationId === conversationId && p.status === "working")) {
        return false;
      }

      if (!conversationId) {
        setCreating(true);
        try {
          const conversation = await conversationsApi.create();
          conversationId = conversation._id;
          client.setQueryData(keys.conversation(conversation._id), conversation);
          justCreated.current = conversation._id;
          navigate(`/c/${conversation._id}`);
        } catch (error) {
          toast({ title: "Couldn't start a new chat", description: userMessage(error), variant: "error" });
          return false;
        } finally {
          setCreating(false);
        }
      }

      const item: PendingSend = {
        id: newId(),
        conversationId,
        prompt: input.prompt,
        agent: input.agent,
        backendAgent: input.backendAgent,
        file: input.file,
        previewUrl: input.file && isImage(input.file.type) ? URL.createObjectURL(input.file) : undefined,
        status: "working",
        progress: input.file ? 0 : null,
        startedAt: Date.now(),
        createdAt: new Date().toISOString(),
      };

      setPending((current) => [...current, item]);
      void run(item);
      return true;
    },
    [client, navigate, run, toast],
  );

  const retry = useCallback(
    (id: string) => {
      const item = pendingRef.current.find((p) => p.id === id);
      if (item && item.status === "failed") void run(item);
    },
    [run],
  );

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
  }, []);

  const dismiss = useCallback((id: string) => remove(id), [remove]);

  // Abort anything in flight when the app unmounts.
  useEffect(() => {
    const active = controllers.current;
    return () => active.forEach((controller) => controller.abort());
  }, []);

  const pendingFor = useCallback(
    (conversationId: string | undefined) =>
      conversationId ? pending.filter((item) => item.conversationId === conversationId) : [],
    [pending],
  );

  const isBusy = useCallback(
    (conversationId: string | undefined) =>
      !!conversationId &&
      pending.some((item) => item.conversationId === conversationId && item.status === "working"),
    [pending],
  );

  const value = useMemo(
    () => ({ pendingFor, isBusy, creating, send, retry, cancel, dismiss, isJustCreated, clearJustCreated }),
    [pendingFor, isBusy, creating, send, retry, cancel, dismiss, isJustCreated, clearJustCreated],
  );

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSession() {
  const context = useContext(ChatSessionContext);
  if (!context) throw new Error("useChatSession must be used inside ChatSessionProvider");
  return context;
}
