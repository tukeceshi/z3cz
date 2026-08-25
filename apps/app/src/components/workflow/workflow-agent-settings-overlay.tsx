import type {
  AgentChatDirectoryEntry,
  AgentChatMessage,
  OrgTextModelOption,
} from "@dafthunk/types";
import {
  conversationHasMessages,
  fingerprintAgentChatBody,
  titleFromMessages,
} from "@dafthunk/types";
import ArrowUp from "lucide-react/icons/arrow-up";
import ChevronDown from "lucide-react/icons/chevron-down";
import Copy from "lucide-react/icons/copy";
import History from "lucide-react/icons/history";
import Plus from "lucide-react/icons/plus";
import Square from "lucide-react/icons/square";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";
import {
  getAgentChatBody,
  listAgentChats,
  putAgentChatBody,
  sealAgentChat,
  resumeAgentChatStream,
  stopAgentChatStream,
  streamAgentChat,
  switchAgentChat,
  type StreamAgentChatResult,
} from "@/services/agent-chat-service";
import {
  createEmptyLocalConversation,
  deleteLocalAgentConversation,
  listLocalAgentConversations,
  readLastOpenAgentConversationId,
  readLocalAgentConversation,
  writeLastOpenAgentConversationId,
  writeLocalAgentConversation,
  type LocalAgentConversation,
} from "@/services/agent-chat-local-store";
import { useOrgTextModels } from "@/services/platform-ai-model-service";

import {
  isNearScrollBottom,
  scrollContainerToBottom,
} from "./ai-text-preview-scroll";
import {
  AGENT_CHAT_AUTO_ID,
  contextLimitForModel,
  groupAgentChatTurns,
  selectableTextModelsInOrder,
  shouldFetchSealedAgentChatBody,
  shouldSubmitAgentChatOnEnter,
  trimMessagesForContext,
} from "./agent-chat-utils";

type AgentStreamStatus = "idle" | "generating" | "reconnecting" | "stopped";

const agentWidthClassName = "w-[20vw] min-w-[400px]";
const agentExpandedHeightClassName = "h-[calc(100dvh-3.5rem-1rem)]";
const CLOUD_SYNC_DEBOUNCE_MS = 30_000;
const AGENT_LINE_HEIGHT_PX = 20;
const AGENT_TEXTAREA_Y_PADDING_PX = 16;
const AGENT_COLLAPSED_MAX_LINES = 2.5;
const AGENT_COLLAPSED_MAX_HEIGHT_PX =
  AGENT_TEXTAREA_Y_PADDING_PX + AGENT_LINE_HEIGHT_PX * AGENT_COLLAPSED_MAX_LINES;
const AGENT_EXPANDED_MAX_HEIGHT_PX = 200;

const agentBubbleShellClassName =
  "rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800";

const agentTextareaClassName =
  "w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm leading-5 text-neutral-900 outline-none dark:text-neutral-100";

function syncTextareaHeight(
  textarea: HTMLTextAreaElement,
  maxHeightPx: number
): boolean {
  textarea.style.height = "0px";
  const scrollHeight = textarea.scrollHeight;
  const nextHeight = Math.min(scrollHeight, maxHeightPx);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = scrollHeight > maxHeightPx ? "auto" : "hidden";
  return scrollHeight > maxHeightPx;
}

export interface WorkflowAgentSettingsOverlayProps {
  readonly orgId?: string;
  readonly workflowId?: string;
  readonly workflowName?: string;
}

function messageId(): string {
  return crypto.randomUUID();
}

export function WorkflowAgentSettingsOverlay({
  orgId,
  workflowId,
  workflowName = "",
}: WorkflowAgentSettingsOverlayProps) {
  const { t } = useTranslation();
  const { models } = useOrgTextModels(orgId, { enabled: Boolean(orgId) });
  const selectableModels = useMemo(
    () => selectableTextModelsInOrder(models),
    [models]
  );

  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [modelId, setModelId] = useState<string>(AGENT_CHAT_AUTO_ID);
  const [conversation, setConversation] = useState<LocalAgentConversation | null>(
    null
  );
  const [history, setHistory] = useState<readonly AgentChatDirectoryEntry[]>([]);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<AgentStreamStatus>("idle");
  const [resendIndex, setResendIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userStopRef = useRef(false);
  const invocationIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedModelLabel = useMemo(() => {
    if (modelId === AGENT_CHAT_AUTO_ID) {
      return t("workflow.canvas.agentModelAuto");
    }
    return (
      selectableModels.find((model) => model.optionId === modelId)?.displayName ??
      t("workflow.canvas.agentModelAuto")
    );
  }, [modelId, selectableModels, t]);

  const canSend = draft.trim().length > 0 && !streaming && Boolean(orgId);

  const persistLocal = useCallback(
    async (next: LocalAgentConversation) => {
      if (!orgId || !workflowId) {
        return;
      }
      if (
        conversationHasMessages({ messages: next.messages })
      ) {
        await writeLocalAgentConversation({
          organizationId: orgId,
          workflowId,
          workflowName: workflowName || workflowId,
          conversation: next,
        });
      }
      await writeLastOpenAgentConversationId({
        organizationId: orgId,
        workflowId,
        conversationId: next.id,
      });
    },
    [orgId, workflowId, workflowName]
  );

  const loadConversationById = useCallback(
    async (
      conversationId: string,
      listed: readonly AgentChatDirectoryEntry[]
    ): Promise<LocalAgentConversation | null> => {
      if (!orgId || !workflowId) {
        return null;
      }
      const remote = listed.find((entry) => entry.id === conversationId);
      const local = await readLocalAgentConversation({
        organizationId: orgId,
        workflowId,
        conversationId,
      });
      let current =
        local ??
        createEmptyLocalConversation({
          organizationId: orgId,
          workflowId,
          id: conversationId,
        });
      if (
        remote &&
        shouldFetchSealedAgentChatBody({
          sealed: remote.sealed,
          remoteFingerprint: remote.fingerprint,
          localFingerprint: local
            ? fingerprintAgentChatBody({ messages: local.messages })
            : "",
        })
      ) {
        try {
          const fetched = await getAgentChatBody(orgId, conversationId);
          if (fetched.body.messages.length > 0) {
            current = {
              ...current,
              title: remote.title || current.title,
              messages: fetched.body.messages,
              updatedAt: remote.updatedAt,
            };
          }
        } catch {
          // keep local
        }
      }
      return current;
    },
    [orgId, workflowId]
  );

  const scheduleCloudSync = useCallback(
    (next: LocalAgentConversation) => {
      if (!orgId || !workflowId || !cloudEnabled) {
        return;
      }
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = window.setTimeout(() => {
        void putAgentChatBody(orgId, next.id, {
          workflowId,
          title: next.title,
          body: { messages: next.messages },
        }).catch(() => undefined);
      }, CLOUD_SYNC_DEBOUNCE_MS);
    },
    [cloudEnabled, orgId, workflowId]
  );

  const flushCloudSync = useCallback(
    async (next: LocalAgentConversation) => {
      if (!orgId || !workflowId || !cloudEnabled) {
        return;
      }
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (next.messages.length === 0) {
        return;
      }
      await putAgentChatBody(orgId, next.id, {
        workflowId,
        title: next.title,
        body: { messages: next.messages },
      }).catch(() => undefined);
    },
    [cloudEnabled, orgId, workflowId]
  );

  const applyConversation = useCallback(
    async (next: LocalAgentConversation) => {
      setConversation(next);
      await persistLocal(next);
      scheduleCloudSync(next);
    },
    [persistLocal, scheduleCloudSync]
  );

  const refreshHistory = useCallback(async (): Promise<
    readonly AgentChatDirectoryEntry[]
  > => {
    if (!orgId || !workflowId) {
      return [];
    }
    const local = await listLocalAgentConversations({
      organizationId: orgId,
      workflowId,
    });
    let remote: ListLike = { conversations: [], cloudEnabled: false };
    try {
      remote = await listAgentChats(orgId, workflowId);
      setCloudEnabled(remote.cloudEnabled);
    } catch {
      setCloudEnabled(false);
    }

    const byId = new Map<string, AgentChatDirectoryEntry>();
    for (const entry of remote.conversations) {
      byId.set(entry.id, entry);
    }
    for (const item of local) {
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, {
          id: item.id,
          workflowId: item.workflowId,
          title: item.title,
          cloudPath: "",
          sealed: true,
          holderUserId: null,
          holderIsSelf: true,
          inUse: false,
          fingerprint: fingerprintAgentChatBody({ messages: item.messages }),
          updatedAt: item.updatedAt,
        });
      } else if (!existing.title && item.title) {
        byId.set(item.id, { ...existing, title: item.title });
      }
    }
    const merged = [...byId.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
    setHistory(merged);
    return merged;
  }, [orgId, workflowId]);

  useEffect(() => {
    if (!orgId || !workflowId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const listed = await refreshHistory();
      if (cancelled) {
        return;
      }
      const lastId = await readLastOpenAgentConversationId({
        organizationId: orgId,
        workflowId,
      });
      const ownOpen = listed.find((entry) => entry.holderIsSelf);
      const startId = ownOpen?.id ?? lastId ?? listed[0]?.id;
      if (startId) {
        const current = await loadConversationById(startId, listed);
        if (!cancelled && current) {
          setConversation(current);
          await persistLocal(current);
        }
        return;
      }
      const empty = createEmptyLocalConversation({
        organizationId: orgId,
        workflowId,
      });
      if (!cancelled) {
        setConversation(empty);
        await persistLocal(empty);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadConversationById, orgId, persistLocal, refreshHistory, workflowId]);

  const resolveModelsToTry = useCallback((): readonly OrgTextModelOption[] => {
    if (modelId === AGENT_CHAT_AUTO_ID) {
      return selectableModels;
    }
    const selected = selectableModels.find((model) => model.optionId === modelId);
    return selected ? [selected] : selectableModels.slice(0, 1);
  }, [modelId, selectableModels]);

  const stopActiveGeneration = useCallback(async () => {
    const invocationId = invocationIdRef.current;
    if (!orgId || !invocationId) {
      return;
    }
    await stopAgentChatStream(orgId, invocationId).catch(() => undefined);
  }, [orgId]);

  const consumeWithResume = useCallback(
    async (
      controller: AbortController,
      start: () => Promise<StreamAgentChatResult>,
      handlers: {
        readonly onStarted: (invocationId: string) => void;
        readonly onDelta: (delta: string, fullText: string) => void;
      }
    ): Promise<StreamAgentChatResult> => {
      let next = start;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (controller.signal.aborted || userStopRef.current) {
          break;
        }
        try {
          const result = await next();
          if (!userStopRef.current) {
            setStreamStatus("generating");
          }
          return result;
        } catch (error) {
          if (controller.signal.aborted || userStopRef.current) {
            throw error instanceof Error ? error : new Error("Stopped");
          }
          const invocationId = invocationIdRef.current;
          if (!orgId || !invocationId) {
            throw error instanceof Error ? error : new Error("Stream failed");
          }
          setStreamStatus("reconnecting");
          lastError =
            error instanceof Error ? error : new Error("Stream disconnected");
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 800);
          });
          next = () =>
            resumeAgentChatStream(orgId, invocationId, {
              signal: controller.signal,
              onStarted: handlers.onStarted,
              onDelta: handlers.onDelta,
            });
        }
      }
      throw lastError ?? new Error(t("workflow.canvas.agentResumeFailed"));
    },
    [orgId, t]
  );

  const runGeneration = useCallback(
    async (
      base: LocalAgentConversation,
      historyMessages: readonly AgentChatMessage[]
    ) => {
      if (!orgId) {
        return;
      }
      if (cloudEnabled && workflowId) {
        try {
          const claimed = await switchAgentChat(orgId, {
            workflowId,
            currentConversationId: base.id,
            currentTitle: base.title,
            currentBody: { messages: historyMessages },
            targetConversationId: base.id,
          });
          if (claimed.inUse) {
            setBusyId(base.id);
            return;
          }
        } catch {
          // local-only if the directory call fails
        }
      }
      const modelsToTry = resolveModelsToTry();
      if (modelsToTry.length === 0) {
        setError(t("workflow.canvas.agentNoModel"));
        return;
      }

      await stopActiveGeneration();
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      userStopRef.current = false;
      invocationIdRef.current = null;
      setStreaming(true);
      setStreamStatus("generating");
      setError(null);

      const assistantId = messageId();
      let working: LocalAgentConversation = {
        ...base,
        messages: [
          ...historyMessages,
          { id: assistantId, role: "assistant", content: "" },
        ],
        title: titleFromMessages(historyMessages, base.title),
        updatedAt: new Date().toISOString(),
        activeInvocationId: undefined,
      };
      setConversation(working);

      const handleStarted = (id: string) => {
        invocationIdRef.current = id;
        working = {
          ...working,
          activeInvocationId: id,
          updatedAt: new Date().toISOString(),
        };
        setConversation(working);
        void persistLocal(working);
      };
      const handleDelta = (_delta: string, fullText: string) => {
        working = {
          ...working,
          messages: working.messages.map((message) =>
            message.id === assistantId
              ? { ...message, content: fullText }
              : message
          ),
          updatedAt: new Date().toISOString(),
        };
        setConversation(working);
      };

      let started = false;
      let lastError = t("workflow.canvas.agentGenerateFailed");

      for (const model of modelsToTry) {
        if (controller.signal.aborted || userStopRef.current) {
          break;
        }
        const limits = contextLimitForModel(model);
        const trimmed = trimMessagesForContext({
          messages: historyMessages,
          contextWindowTokens: limits.contextWindowTokens,
          outputMaxTokens: limits.outputMaxTokens,
        });
        try {
          const result = await consumeWithResume(
            controller,
            () =>
              streamAgentChat(
                orgId,
                {
                  modelCanonicalId: model.canonicalId,
                  aiInterfaceId: model.interfaceId,
                  workflowId,
                  messages: trimmed.map((message) => ({
                    role: message.role,
                    content: message.content,
                  })),
                },
                {
                  signal: controller.signal,
                  onStarted: (id) => {
                    started = true;
                    handleStarted(id);
                  },
                  onDelta: (delta, fullText) => {
                    started = true;
                    handleDelta(delta, fullText);
                  },
                }
              ),
            {
              onStarted: handleStarted,
              onDelta: handleDelta,
            }
          );
          working = {
            ...working,
            messages: working.messages.map((message) =>
              message.id === assistantId
                ? { ...message, content: result.text }
                : message
            ),
            activeInvocationId: undefined,
            updatedAt: new Date().toISOString(),
          };
          await applyConversation(working);
          invocationIdRef.current = null;
          setStreaming(false);
          setStreamStatus(result.stopped ? "stopped" : "idle");
          return;
        } catch (error) {
          if (controller.signal.aborted || userStopRef.current) {
            break;
          }
          lastError = error instanceof Error ? error.message : lastError;
          if (started) {
            break;
          }
        }
      }

      working = { ...working, activeInvocationId: undefined };
      await persistLocal(working);
      setConversation(working);
      invocationIdRef.current = null;
      setStreaming(false);
      if (userStopRef.current) {
        setStreamStatus("stopped");
        return;
      }
      setStreamStatus("idle");
      if (!controller.signal.aborted) {
        setError(lastError);
      }
    },
    [
      applyConversation,
      cloudEnabled,
      consumeWithResume,
      orgId,
      persistLocal,
      resolveModelsToTry,
      stopActiveGeneration,
      t,
      workflowId,
    ]
  );

  const resumeExisting = useCallback(
    async (base: LocalAgentConversation) => {
      const invocationId = base.activeInvocationId;
      if (!orgId || !invocationId) {
        return;
      }
      const last = base.messages[base.messages.length - 1];
      const assistantId =
        last?.role === "assistant" ? last.id : messageId();
      let working: LocalAgentConversation =
        last?.role === "assistant"
          ? base
          : {
              ...base,
              messages: [
                ...base.messages,
                { id: assistantId, role: "assistant", content: "" },
              ],
            };

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      userStopRef.current = false;
      invocationIdRef.current = base.activeInvocationId;
      setStreaming(true);
      setStreamStatus("reconnecting");
      setError(null);
      setConversation(working);

      try {
        const handleStarted = (id: string) => {
          invocationIdRef.current = id;
          working = { ...working, activeInvocationId: id };
          setConversation(working);
          void persistLocal(working);
        };
        const handleDelta = (_delta: string, fullText: string) => {
          working = {
            ...working,
            messages: working.messages.map((message) =>
              message.id === assistantId
                ? { ...message, content: fullText }
                : message
            ),
            updatedAt: new Date().toISOString(),
          };
          setConversation(working);
        };
        const result = await consumeWithResume(
          controller,
          () =>
            resumeAgentChatStream(orgId, invocationId, {
              signal: controller.signal,
              onStarted: handleStarted,
              onDelta: handleDelta,
            }),
          { onStarted: handleStarted, onDelta: handleDelta }
        );
        working = {
          ...working,
          messages: working.messages.map((message) =>
            message.id === assistantId
              ? { ...message, content: result.text }
              : message
          ),
          activeInvocationId: undefined,
          updatedAt: new Date().toISOString(),
        };
        await applyConversation(working);
        invocationIdRef.current = null;
        setStreaming(false);
        setStreamStatus(result.stopped ? "stopped" : "idle");
      } catch {
        working = { ...working, activeInvocationId: undefined };
        await persistLocal(working);
        setConversation(working);
        if (userStopRef.current) {
          setStreamStatus("stopped");
        } else {
          setError(t("workflow.canvas.agentResumeFailed"));
          setStreamStatus("idle");
        }
        invocationIdRef.current = null;
        setStreaming(false);
      }
    },
    [applyConversation, consumeWithResume, orgId, persistLocal, t]
  );

  const resumedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const invocationId = conversation?.activeInvocationId;
    if (!conversation || !invocationId || streaming) {
      return;
    }
    const key = `${conversation.id}:${invocationId}`;
    if (resumedKeyRef.current === key) {
      return;
    }
    resumedKeyRef.current = key;
    void resumeExisting(conversation);
  }, [conversation, resumeExisting, streaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const lastAssistantContent = useMemo(() => {
    const last = conversation?.messages[conversation.messages.length - 1];
    return last?.role === "assistant" ? last.content : "";
  }, [conversation?.messages]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesScrollRef.current;
    if (!container) {
      return;
    }
    stickToBottomRef.current = isNearScrollBottom(container);
  }, []);

  const scrollMessagesToBottomIfAllowed = useCallback(() => {
    if (!stickToBottomRef.current) {
      return;
    }
    const container = messagesScrollRef.current;
    if (container) {
      scrollContainerToBottom(container);
    }
  }, []);

  useLayoutEffect(() => {
    scrollMessagesToBottomIfAllowed();
  }, [
    conversation?.messages,
    lastAssistantContent,
    streaming,
    open,
    scrollMessagesToBottomIfAllowed,
  ]);

  useLayoutEffect(() => {
    const textarea = composerTextareaRef.current;
    if (!textarea) {
      return;
    }
    syncTextareaHeight(textarea, AGENT_EXPANDED_MAX_HEIGHT_PX);
  }, [draft, open]);

  const handleStop = async () => {
    userStopRef.current = true;
    const invocationId =
      invocationIdRef.current ?? conversation?.activeInvocationId;
    let stoppedText: string | undefined;
    if (orgId && invocationId) {
      try {
        const result = await stopAgentChatStream(orgId, invocationId);
        stoppedText = result.text;
      } catch {
        // keep local text
      }
    }
    abortRef.current?.abort();
    if (!conversation) {
      setStreaming(false);
      setStreamStatus("stopped");
      return;
    }
    const last = conversation.messages[conversation.messages.length - 1];
    const messages =
      stoppedText !== undefined && last?.role === "assistant"
        ? conversation.messages.map((message) =>
            message.id === last.id
              ? { ...message, content: stoppedText }
              : message
          )
        : conversation.messages;
    const next: LocalAgentConversation = {
      ...conversation,
      messages,
      activeInvocationId: undefined,
      updatedAt: new Date().toISOString(),
    };
    invocationIdRef.current = null;
    await applyConversation(next);
    setStreaming(false);
    setStreamStatus("stopped");
  };

  const handleSendNew = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || !conversation) {
      return;
    }
    stickToBottomRef.current = true;
    const content = draft.trim();
    setDraft("");
    const userMessage: AgentChatMessage = {
      id: messageId(),
      role: "user",
      content,
    };
    const nextMessages = [...conversation.messages, userMessage];
    const next: LocalAgentConversation = {
      ...conversation,
      messages: nextMessages,
      title: titleFromMessages(nextMessages, conversation.title),
      updatedAt: new Date().toISOString(),
    };
    await persistLocal(next);
    setConversation(next);
    await runGeneration(next, nextMessages);
  };

  const resendFromIndex = async (index: number) => {
    if (!conversation) {
      return;
    }
    const userMessage = conversation.messages[index];
    if (!userMessage || userMessage.role !== "user") {
      return;
    }
    const nextMessages = conversation.messages.slice(0, index + 1);
    const next: LocalAgentConversation = {
      ...conversation,
      messages: nextMessages,
      title: titleFromMessages(nextMessages, conversation.title),
      updatedAt: new Date().toISOString(),
    };
    setResendIndex(null);
    await persistLocal(next);
    setConversation(next);
    await runGeneration(next, nextMessages);
  };

  const handleConfirmResend = async () => {
    if (resendIndex === null) {
      return;
    }
    await resendFromIndex(resendIndex);
  };

  const handleNewConversation = async () => {
    if (!orgId || !workflowId || !conversation) {
      return;
    }
    await flushCloudSync(conversation);
    try {
      const result = await switchAgentChat(orgId, {
        workflowId,
        currentConversationId: conversation.id,
        currentTitle: conversation.title,
        currentBody: { messages: conversation.messages },
      });
      if (result.inUse) {
        setBusyId(result.current.id);
        await refreshHistory();
        return;
      }
      if (conversation.messages.length === 0) {
        await deleteLocalAgentConversation({
          organizationId: orgId,
          workflowId,
          conversationId: conversation.id,
        });
      }
      const empty = createEmptyLocalConversation({
        organizationId: orgId,
        workflowId,
        id: result.current.id,
      });
      setConversation(empty);
      await persistLocal(empty);
      await refreshHistory();
      setHistoryOpen(false);
    } catch {
      if (conversation.messages.length === 0) {
        await deleteLocalAgentConversation({
          organizationId: orgId,
          workflowId,
          conversationId: conversation.id,
        });
      }
      const empty = createEmptyLocalConversation({
        organizationId: orgId,
        workflowId,
      });
      setConversation(empty);
      await persistLocal(empty);
      await refreshHistory();
      setHistoryOpen(false);
    }
  };

  const handleSelectHistory = async (entry: AgentChatDirectoryEntry) => {
    if (!orgId || !workflowId || !conversation) {
      return;
    }
    if (entry.id === conversation.id) {
      setHistoryOpen(false);
      return;
    }
    await flushCloudSync(conversation);
    if (cloudEnabled) {
      if (!entry.sealed) {
        await sealAgentChat(orgId, entry.id).catch(() => undefined);
      }
      await switchAgentChat(orgId, {
        workflowId,
        currentConversationId: conversation.id,
        currentTitle: conversation.title,
        currentBody: { messages: conversation.messages },
        targetConversationId: entry.id,
      }).catch(() => undefined);
    }
    const listed = await refreshHistory();
    const next = await loadConversationById(entry.id, listed);
    if (next) {
      setConversation(next);
      await persistLocal(next);
    }
    setHistoryOpen(false);
  };

  const handleUserContentChange = (messageIdValue: string, content: string) => {
    if (!conversation) {
      return;
    }
    setConversation({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageIdValue ? { ...message, content } : message
      ),
    });
  };

  const handleResendClick = (index: number) => {
    const hasBelow = Boolean(
      conversation && conversation.messages.slice(index + 1).length > 0
    );
    if (hasBelow) {
      setResendIndex(index);
      return;
    }
    void resendFromIndex(index);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !shouldSubmitAgentChatOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
        keyCode: event.keyCode,
      })
    ) {
      return;
    }
    event.preventDefault();
    if (!canSend) {
      return;
    }
    event.currentTarget.form?.requestSubmit();
  };

  const handleHistoryKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
    index: number
  ) => {
    if (
      !shouldSubmitAgentChatOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isComposing: event.nativeEvent.isComposing,
        keyCode: event.keyCode,
      })
    ) {
      return;
    }
    event.preventDefault();
    if (streaming) {
      return;
    }
    handleResendClick(index);
  };

  const handleCopyAssistant = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // clipboard may be unavailable
    }
  };

  const turns = groupAgentChatTurns(conversation?.messages ?? []);
  const lastTurnIndex = turns.length - 1;
  const statusLabel =
    streamStatus === "generating"
      ? t("workflow.canvas.agentStatusGenerating")
      : streamStatus === "reconnecting"
        ? t("workflow.canvas.agentStatusReconnecting")
        : streamStatus === "stopped"
          ? t("workflow.canvas.agentStatusStopped")
          : null;

  return (
    <div
      className={cn(
        "nodrag nowheel relative flex flex-col items-stretch rounded-lg border",
        agentWidthClassName,
        open
          ? "overflow-hidden border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          : "border-transparent",
        open && agentExpandedHeightClassName
      )}
      role={open ? "dialog" : undefined}
      aria-modal={open ? false : undefined}
      aria-label={open ? t("workflow.canvas.agentDialogTitle") : undefined}
    >
      {open ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 px-2 pt-2">
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              onClick={() => setHistoryOpen((value) => !value)}
              aria-label={t("workflow.canvas.agentHistory")}
            >
              <History className="size-4" />
            </button>
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              onClick={() => void handleNewConversation()}
              aria-label={t("workflow.canvas.agentNew")}
            >
              <Plus className="size-4" />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              onClick={() => setOpen(false)}
              aria-label={t("workflow.canvas.agentCollapse")}
            >
              <ChevronDown className="size-4" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            {historyOpen ? (
              <div className="absolute inset-y-0 left-0 z-10 w-[70%] overflow-y-auto thin-scrollbar border-r border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
                {history.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-neutral-500">
                    {t("workflow.canvas.agentHistoryEmpty")}
                  </p>
                ) : (
                  history.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => void handleSelectHistory(entry)}
                      className={cn(
                        "mb-1 w-full rounded-md px-2 py-2 text-left text-sm",
                        entry.id === conversation?.id
                          ? "bg-neutral-100 dark:bg-neutral-800"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60",
                        entry.inUse && "opacity-60"
                      )}
                    >
                      <div className="truncate">
                        {entry.title || t("workflow.canvas.agentUntitled")}
                      </div>
                      {entry.inUse ? (
                        <div className="text-xs text-amber-600">
                          {t("workflow.canvas.agentInUse")}
                        </div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div
              ref={messagesScrollRef}
              onScroll={handleMessagesScroll}
              className="h-full overflow-y-auto thin-scrollbar px-3 py-2"
            >
              {turns.map((turn, turnIndex) => (
                <div key={turn.user.id} className="mb-4">
                  <HistoryUserMessage
                    content={turn.user.content}
                    disabled={streaming}
                    sendLabel={t("workflow.canvas.agentSend")}
                    onContentChange={(content) =>
                      handleUserContentChange(turn.user.id, content)
                    }
                    onSend={() => handleResendClick(turn.userIndex)}
                    onKeyDown={(event) =>
                      handleHistoryKeyDown(event, turn.userIndex)
                    }
                  />
                  {turnIndex === lastTurnIndex && statusLabel ? (
                    <p className="mt-1 px-1 text-xs text-neutral-400">
                      {statusLabel}
                    </p>
                  ) : null}
                  {turn.assistant ? (
                    <AssistantReply
                      content={turn.assistant.content}
                      copyLabel={t("workflow.canvas.agentCopy")}
                      onCopy={handleCopyAssistant}
                    />
                  ) : null}
                </div>
              ))}
              {error ? (
                <p className="mb-2 text-xs text-red-600">{error}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <form className="p-2" autoComplete="off" onSubmit={(event) => void handleSendNew(event)}>
        <div
          className={cn(
            "rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800",
            !open && "shadow-lg"
          )}
        >
          <textarea
            ref={composerTextareaRef}
            id="workflow-agent-composer"
            name="agent_composer_draft"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            onFocus={() => setOpen(true)}
            placeholder={t("workflow.canvas.agentInputPlaceholder")}
            autoComplete="off"
            className={cn(
              agentTextareaClassName,
              "thin-scrollbar placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            )}
            style={{ maxHeight: AGENT_EXPANDED_MAX_HEIGHT_PX }}
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  aria-label={t("workflow.canvas.agentSwitchModel")}
                >
                  {selectedModelLabel}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuRadioGroup
                  value={modelId}
                  onValueChange={setModelId}
                >
                  <DropdownMenuRadioItem value={AGENT_CHAT_AUTO_ID}>
                    {t("workflow.canvas.agentModelAuto")}
                  </DropdownMenuRadioItem>
                  {selectableModels.map((model) => (
                    <DropdownMenuRadioItem
                      key={model.optionId}
                      value={model.optionId}
                    >
                      {model.displayName}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {streaming ? (
              <button
                type="button"
                onClick={() => void handleStop()}
                aria-label={t("workflow.canvas.agentStop")}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-lg",
                  "bg-neutral-800 text-white hover:bg-neutral-700",
                  "dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
                )}
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t("workflow.canvas.agentSend")}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-lg",
                  "bg-neutral-800 text-white hover:bg-neutral-700",
                  "dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white",
                  "disabled:pointer-events-none disabled:opacity-30"
                )}
              >
                <ArrowUp className="size-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>

      <AlertDialog
        open={resendIndex !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setResendIndex(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workflow.canvas.agentResendTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflow.canvas.agentResendConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmResend()}>
              {t("workflow.canvas.agentResendAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={busyId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setBusyId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workflow.canvas.agentInUseTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("workflow.canvas.agentInUse")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBusyId(null)}>
              {t("workflow.canvas.agentInUseOk")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ListLike {
  readonly conversations: readonly AgentChatDirectoryEntry[];
  readonly cloudEnabled: boolean;
}

function HistoryUserMessage({
  content,
  disabled,
  sendLabel,
  onContentChange,
  onSend,
  onKeyDown,
}: {
  readonly content: string;
  readonly disabled: boolean;
  readonly sendLabel: string;
  readonly onContentChange: (content: string) => void;
  readonly onSend: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const [collapsedOverflows, setCollapsedOverflows] = useState(false);
  const inlineRef = useRef<HTMLDivElement | null>(null);
  const collapsedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncCollapsedHeight = useCallback(() => {
    const textarea = collapsedTextareaRef.current;
    if (!textarea) {
      return;
    }
    const overflows = syncTextareaHeight(
      textarea,
      AGENT_COLLAPSED_MAX_HEIGHT_PX
    );
    setCollapsedOverflows(overflows);
  }, []);

  const syncExpandedHeight = useCallback(() => {
    const textarea = expandedTextareaRef.current;
    if (!textarea) {
      return;
    }
    syncTextareaHeight(textarea, AGENT_EXPANDED_MAX_HEIGHT_PX);
  }, []);

  useLayoutEffect(() => {
    if (focused) {
      syncExpandedHeight();
      return;
    }
    syncCollapsedHeight();
  }, [content, focused, syncCollapsedHeight, syncExpandedHeight]);

  const handleFocus = () => {
    if (disabled) {
      return;
    }
    if (inlineRef.current) {
      setPlaceholderHeight(inlineRef.current.offsetHeight);
    }
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
  };

  const sendDisabled = disabled || content.trim().length === 0;

  return (
    <div className="relative">
      {focused ? (
        <div aria-hidden style={{ height: placeholderHeight }} />
      ) : (
        <div
          ref={inlineRef}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={handleFocus}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleFocus();
            }
          }}
          className={cn(
            agentBubbleShellClassName,
            collapsedOverflows && "agent-history-collapsed-fade overflow-hidden",
            !disabled && "cursor-text"
          )}
        >
          <textarea
            ref={collapsedTextareaRef}
            value={content}
            readOnly
            tabIndex={-1}
            rows={1}
            aria-hidden
            className={cn(agentTextareaClassName, "pointer-events-none")}
            style={{ maxHeight: AGENT_COLLAPSED_MAX_HEIGHT_PX }}
          />
        </div>
      )}

      {focused ? (
        <div
          className={cn(
            agentBubbleShellClassName,
            "absolute inset-x-0 top-0 z-20 shadow-md"
          )}
        >
          <textarea
            ref={expandedTextareaRef}
            value={content}
            disabled={disabled}
            autoFocus
            rows={1}
            onChange={(event) => onContentChange(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={handleBlur}
            className={cn(agentTextareaClassName, "thin-scrollbar")}
            style={{ maxHeight: AGENT_EXPANDED_MAX_HEIGHT_PX }}
          />
          <div className="flex justify-end px-2 pb-2">
            <button
              type="button"
              disabled={sendDisabled}
              aria-label={sendLabel}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onSend}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-lg",
                "bg-neutral-800 text-white hover:bg-neutral-700",
                "dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white",
                "disabled:pointer-events-none disabled:opacity-30"
              )}
            >
              <ArrowUp className="size-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssistantReply({
  content,
  copyLabel,
  onCopy,
}: {
  readonly content: string;
  readonly copyLabel: string;
  readonly onCopy: (content: string) => void;
}) {
  return (
    <div className="mt-2 px-1">
      <div className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
        {content}
      </div>
      {content ? (
        <button
          type="button"
          className="mt-1 p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          aria-label={copyLabel}
          onClick={() => onCopy(content)}
        >
          <Copy className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
