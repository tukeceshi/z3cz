import type {
  AgentChatAnswer,
  AgentChatDirectoryEntry,
  AgentChatMessage,
  AgentChatToolCall,
  OrgTextModelOption,
} from "@dafthunk/types";
import {
  conversationHasMessages,
  fingerprintAgentChatBody,
  titleFromMessages,
} from "@dafthunk/types";
import type {
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import ArrowUp from "lucide-react/icons/arrow-up";
import ChevronDown from "lucide-react/icons/chevron-down";
import Clapperboard from "lucide-react/icons/clapperboard";
import Copy from "lucide-react/icons/copy";
import History from "lucide-react/icons/history";
import List from "lucide-react/icons/list";
import Plus from "lucide-react/icons/plus";
import Square from "lucide-react/icons/square";
import X from "lucide-react/icons/x";
import {
  type FormEvent,
  forwardRef,
  type KeyboardEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "@/components/locale-provider";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  compactCanvasAgentState,
  executeCanvasAgentTool,
  formatCanvasInventory,
} from "@/services/agent-canvas-state";
import {
  createEmptyLocalConversation,
  deleteLocalAgentConversation,
  type LocalAgentConversation,
  listLocalAgentConversations,
  readLastOpenAgentConversationId,
  readLocalAgentConversation,
  writeLastOpenAgentConversationId,
  writeLocalAgentConversation,
} from "@/services/agent-chat-local-store";
import {
  type AgentAskQuestion,
  type AgentSchedulerMessage,
  type AgentSchedulerStreamResult,
  answerToHistoryContent,
  composeSavedAnswer,
  mergeLiveSchedulerAnswer,
  parseAgentSchedulerOutput,
  parseSavedAnswer,
  runAgentScheduler,
  schedulerMessagesToChat,
  splitSavedAssistantContent,
} from "@/services/agent-chat-scheduler";
import {
  getAgentChatBody,
  listAgentChats,
  putAgentChatBody,
  resumeAgentChatStream,
  type StreamAgentChatResult,
  sealAgentChat,
  stopAgentChatStream,
  streamAgentChat,
  switchAgentChat,
} from "@/services/agent-chat-service";
import {
  type AgentSessionMode,
  hasCapability,
  isPlanConfirmPending,
  isPlanRestriction,
  modeOnOpenConversation,
  SIMPLE_ANIMATION_CAPABILITY,
  stateAfterRun,
} from "@/services/agent-session-mode";
import { useOrgTextModels } from "@/services/platform-ai-model-service";
import { compileRemotionSource } from "@/services/remotion-live-compile";
import {
  DEFAULT_REMOTION_SOURCE_CODE,
  readRemotionViewportContent,
  writeRemotionViewportContent,
} from "@/services/remotion-viewport-staging";
import { stageGenerativeMediaFromEphemeralUrl } from "@/services/stage-generative-media";
import { cn } from "@/utils/utils";
import {
  AGENT_CHAT_AUTO_ID,
  type AgentContextUsage,
  agentContextUsage,
  contextLimitForModel,
  estimateAgentContextUsedTokens,
  formatAgentContextTokenCount,
  groupAgentChatTurns,
  isAgentThinkingLive,
  resolveAgentContextModel,
  selectableTextModelsInOrder,
  shouldFetchSealedAgentChatBody,
  shouldSubmitAgentChatOnEnter,
  trimMessagesForContext,
} from "./agent-chat-utils";
import {
  isNearScrollBottom,
  scrollContainerToBottom,
} from "./ai-text-preview-scroll";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { commitAiTextValue } from "./commit-ai-text-value";
import { createPatchNodeLayoutMetadata } from "./patch-node-layout-metadata";
import { useWorkflow } from "./workflow-context";
import type { WorkflowEdgeType, WorkflowNodeType } from "./workflow-types";

const RemotionViewportOverlay = lazy(() =>
  import("./remotion-viewport-overlay").then((module) => ({
    default: module.RemotionViewportOverlay,
  }))
);

const REMOTION_COMPACT_PREVIEW_HEIGHT_PX = 225;

type AgentStreamStatus = "idle" | "generating" | "reconnecting" | "stopped";

const agentWidthClassName = "w-[20vw] min-w-[400px]";
const agentExpandedHeightClassName = "h-[calc(100dvh-3.5rem-1rem)]";
const CLOUD_SYNC_DEBOUNCE_MS = 30_000;
const AGENT_LINE_HEIGHT_PX = 20;
const AGENT_TEXTAREA_Y_PADDING_PX = 16;
const AGENT_COLLAPSED_MAX_LINES = 2.5;
const AGENT_COLLAPSED_MAX_HEIGHT_PX =
  AGENT_TEXTAREA_Y_PADDING_PX +
  AGENT_LINE_HEIGHT_PX * AGENT_COLLAPSED_MAX_LINES;
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
  readonly remotionViewportOpen?: boolean;
  readonly onToggleRemotionViewport?: () => void;
  readonly onOpenRemotionViewport?: () => void;
  readonly onCloseRemotionViewport?: () => void;
  readonly getCanvasGraph?: () => {
    readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
    readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  };
}

export interface WorkflowAgentSettingsOverlayHandle {
  readonly dimOnCanvasClick: () => void;
}

function messageId(): string {
  return crypto.randomUUID();
}

export const WorkflowAgentSettingsOverlay = forwardRef<
  WorkflowAgentSettingsOverlayHandle,
  WorkflowAgentSettingsOverlayProps
>(function WorkflowAgentSettingsOverlay(
  {
    orgId,
    workflowId,
    workflowName = "",
    remotionViewportOpen = false,
    onToggleRemotionViewport,
    onOpenRemotionViewport,
    onCloseRemotionViewport,
    getCanvasGraph,
  },
  ref
) {
  const { t } = useTranslation();
  const { updateNodeData, onRunNode } = useWorkflow();
  const { configured: cloudConfigured } = useCloudStorageCanvasContext();
  const { models } = useOrgTextModels(orgId, { enabled: Boolean(orgId) });
  const selectableModels = useMemo(
    () => selectableTextModelsInOrder(models),
    [models]
  );

  const [open, setOpen] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [modelId, setModelId] = useState<string>(AGENT_CHAT_AUTO_ID);
  const [conversation, setConversation] =
    useState<LocalAgentConversation | null>(null);
  const [history, setHistory] = useState<readonly AgentChatDirectoryEntry[]>(
    []
  );
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<AgentStreamStatus>("idle");
  const [resendIndex, setResendIndex] = useState<number | null>(null);
  const [sessionMode, setSessionMode] = useState<AgentSessionMode>("ask");
  const [planPanelOpen, setPlanPanelOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"leave-plan" | "execute" | null>(
    null
  );
  const [pendingAsk, setPendingAsk] = useState<AgentAskQuestion | undefined>();
  const [remotionCodeExpanded, setRemotionCodeExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const userStopRef = useRef(false);
  const invocationIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionModeRef = useRef<AgentSessionMode>("ask");
  const consentedRef = useRef<string[]>([]);

  useImperativeHandle(
    ref,
    () => ({
      dimOnCanvasClick: () => {
        if (open) {
          setDimmed(true);
        }
      },
    }),
    [open]
  );

  useEffect(() => {
    if (!open) {
      setDimmed(false);
    }
  }, [open]);

  const handleUndim = useCallback(() => {
    setDimmed(false);
  }, []);

  useEffect(() => {
    sessionModeRef.current = sessionMode;
  }, [sessionMode]);

  useEffect(() => {
    const consented = conversation?.consentedCapabilities;
    consentedRef.current = consented ? [...consented] : [];
    const mode = modeOnOpenConversation({
      sessionMode: conversation?.sessionMode,
      activeInvocationId: conversation?.activeInvocationId,
    });
    sessionModeRef.current = mode;
    setSessionMode(mode);
    setConfirmKind(null);
    setPendingAsk(undefined);
    setPlanPanelOpen(Boolean(conversation?.planDocument));
    // Sync from the opened conversation, not from later local mode toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conversation.id is the switch signal
  }, [conversation?.id]);

  const openRemotionViewport = useCallback(() => {
    if (onOpenRemotionViewport) {
      onOpenRemotionViewport();
      return;
    }
    if (!remotionViewportOpen) {
      onToggleRemotionViewport?.();
    }
  }, [onOpenRemotionViewport, onToggleRemotionViewport, remotionViewportOpen]);

  const patchConsentedCapabilities = useCallback((next: readonly string[]) => {
    consentedRef.current = [...next];
    setConversation((current) =>
      current
        ? {
            ...current,
            consentedCapabilities: consentedRef.current,
          }
        : current
    );
  }, []);

  const requestCapabilityConsent = useCallback(
    async (capabilityId: string) => {
      if (capabilityId === SIMPLE_ANIMATION_CAPABILITY) {
        openRemotionViewport();
      }
      if (!consentedRef.current.includes(capabilityId)) {
        patchConsentedCapabilities([...consentedRef.current, capabilityId]);
      }
      return {
        authorized: true,
        open: true,
      };
    },
    [openRemotionViewport, patchConsentedCapabilities]
  );

  const revokeCapabilityConsent = useCallback(
    async (capabilityId: string) => {
      if (consentedRef.current.includes(capabilityId)) {
        patchConsentedCapabilities(
          consentedRef.current.filter((id) => id !== capabilityId)
        );
      }
      return {
        authorized: true,
        open: false,
      };
    },
    [patchConsentedCapabilities]
  );

  const applyRunSessionState = useCallback(
    (
      current: LocalAgentConversation,
      talk: string,
      options: { readonly preservePlan?: boolean } = {}
    ): LocalAgentConversation => {
      const after = stateAfterRun({
        runMode: sessionModeRef.current,
        talk,
        preservePlan: options.preservePlan,
        previousPlanDocument: current.planDocument,
      });
      sessionModeRef.current = after.sessionMode;
      setSessionMode(after.sessionMode);
      if (after.sessionMode === "plan" && talk.trim()) {
        setPlanPanelOpen(true);
      }
      if (options.preservePlan) {
        setConfirmKind("leave-plan");
      } else {
        setConfirmKind(null);
      }
      setPendingAsk(undefined);
      return {
        ...current,
        sessionMode: after.sessionMode,
        planPending: after.planPending,
        planDocument: after.planDocument,
      };
    },
    []
  );

  const patchSessionMode = useCallback(
    (mode: AgentSessionMode) => {
      sessionModeRef.current = mode;
      setSessionMode(mode);
      setConversation((current) =>
        current ? { ...current, sessionMode: mode } : current
      );
    },
    []
  );

  const enterAskMode = useCallback(() => {
    patchSessionMode("ask");
    setConfirmKind(null);
  }, [patchSessionMode]);

  const handleEnterPlan = useCallback(() => {
    patchSessionMode("plan");
    setPlanPanelOpen(true);
    setConfirmKind(null);
  }, [patchSessionMode]);

  const handleRequestLeavePlan = useCallback(() => {
    setConfirmKind("leave-plan");
  }, []);

  const handleLeavePlanToAsk = useCallback(() => {
    patchSessionMode("ask");
    setConfirmKind(null);
    setConversation((current) =>
      current
        ? {
            ...current,
            sessionMode: "ask",
            planPending: false,
          }
        : current
    );
  }, [patchSessionMode]);

  const runCanvasAgentTool = useCallback(
    async (call: {
      readonly name: string;
      readonly resourceId: string;
      readonly nodeId: string;
      readonly payload: string;
    }) => {
      const graph = getCanvasGraph?.() ?? { nodes: [], edges: [] };
      return executeCanvasAgentTool({
        call,
        snapshot: compactCanvasAgentState(graph.nodes, graph.edges),
        organizationId: orgId,
        capabilities: {
          sessionMode: sessionModeRef.current,
          consentedCapabilities: consentedRef.current,
          requestConsent: requestCapabilityConsent,
          revokeConsent: revokeCapabilityConsent,
          readSource: async () => {
            if (!orgId || !workflowId) {
              return DEFAULT_REMOTION_SOURCE_CODE;
            }
            const content = await readRemotionViewportContent({
              organizationId: orgId,
              workflowId,
            });
            return content.sourceCode;
          },
          writeSource: async (sourceCode) => {
            if (!orgId || !workflowId) {
              return { ok: false, compileError: "无法写入" };
            }
            await writeRemotionViewportContent({
              organizationId: orgId,
              workflowId,
              workflowName: workflowName || workflowId,
              content: { sourceCode },
            });
            const compiled = compileRemotionSource(sourceCode);
            if (compiled.error) {
              return { ok: true, compileError: compiled.error };
            }
            return { ok: true };
          },
          writeText: async (nodeId, text) => {
            const current = graph.nodes.find((node) => node.id === nodeId);
            if (!current || !orgId || !workflowId) {
              return { ok: false, error: "找不到节点" };
            }
            await commitAiTextValue({
              organizationId: orgId,
              workflowId,
              cloudConfigured,
              nodeId,
              value: text,
              updateNodeData,
              current: current.data,
            });
            return { ok: true };
          },
          runNode: async (nodeId) => {
            if (!onRunNode) {
              return { ok: false, error: "无法运行该节点" };
            }
            await onRunNode(nodeId);
            return { ok: true };
          },
          stageMedia: async (nodeId, sourceUrl, mimeType) => {
            const current = graph.nodes.find((node) => node.id === nodeId);
            if (!current || !orgId || !workflowId) {
              return { ok: false, error: "找不到节点" };
            }
            const nodeType = current.data.nodeType;
            const mediaType =
              nodeType === "ai-video"
                ? "ai-video"
                : nodeType === "ai-audio"
                  ? "ai-audio"
                  : "ai-image";
            await stageGenerativeMediaFromEphemeralUrl({
              organizationId: orgId,
              workflowId,
              sourceUrl,
              mimeType:
                mimeType ||
                (mediaType === "ai-video"
                  ? "video/mp4"
                  : mediaType === "ai-audio"
                    ? "audio/mpeg"
                    : "image/png"),
              nodeType: mediaType,
              patchNodeLayout: createPatchNodeLayoutMetadata(
                nodeId,
                updateNodeData
              ),
            });
            return { ok: true };
          },
        },
      });
    },
    [
      cloudConfigured,
      getCanvasGraph,
      onRunNode,
      orgId,
      requestCapabilityConsent,
      revokeCapabilityConsent,
      updateNodeData,
      workflowId,
      workflowName,
    ]
  );

  const contextUsage = useMemo(() => {
    const model = resolveAgentContextModel(modelId, selectableModels);
    if (!model) {
      return null;
    }
    return agentContextUsage({
      used: estimateAgentContextUsedTokens(conversation?.messages ?? [], draft),
      limit: contextLimitForModel(model).contextWindowTokens,
    });
  }, [conversation?.messages, draft, modelId, selectableModels]);

  const selectedModelLabel = useMemo(() => {
    if (modelId === AGENT_CHAT_AUTO_ID) {
      return t("workflow.canvas.agentModelAuto");
    }
    return (
      selectableModels.find((model) => model.optionId === modelId)
        ?.displayName ?? t("workflow.canvas.agentModelAuto")
    );
  }, [modelId, selectableModels, t]);

  const canSend = draft.trim().length > 0 && !streaming && Boolean(orgId);

  const persistLocal = useCallback(
    async (next: LocalAgentConversation) => {
      if (!orgId || !workflowId) {
        return;
      }
      if (conversationHasMessages({ messages: next.messages })) {
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

  const handleExitSimpleAnimation = useCallback(() => {
    const nextCaps = consentedRef.current.filter(
      (id) => id !== SIMPLE_ANIMATION_CAPABILITY
    );
    consentedRef.current = nextCaps;
    setConversation((current) => {
      if (!current) {
        return current;
      }
      const next: LocalAgentConversation = {
        ...current,
        consentedCapabilities: nextCaps,
        updatedAt: new Date().toISOString(),
      };
      void persistLocal(next);
      return next;
    });
  }, [persistLocal]);

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
    const selected = selectableModels.find(
      (model) => model.optionId === modelId
    );
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

  const readCanvasInventory = useCallback((): string => {
    const graph = getCanvasGraph?.() ?? { nodes: [], edges: [] };
    return formatCanvasInventory(
      compactCanvasAgentState(graph.nodes, graph.edges)
    );
  }, [getCanvasGraph]);

  const runGeneration = useCallback(
    async (
      base: LocalAgentConversation,
      historyMessages: readonly AgentChatMessage[],
      options: {
        readonly initialSideResults?: readonly string[];
        readonly continueLastAssistant?: boolean;
      } = {}
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
      setConfirmKind(null);
      setPendingAsk(undefined);

      const lastHistory = historyMessages[historyMessages.length - 1];
      const continuing = Boolean(
        options.continueLastAssistant && lastHistory?.role === "assistant"
      );
      const assistantId = continuing
        ? lastHistory.id
        : messageId();
      const initialAnswer = continuing
        ? parseSavedAnswer(lastHistory.content)
        : undefined;
      let working: LocalAgentConversation = {
        ...base,
        messages: continuing
          ? historyMessages
          : [
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
      const applyAssistantContent = (content: string) => {
        working = {
          ...working,
          messages: working.messages.map((message) =>
            message.id === assistantId ? { ...message, content } : message
          ),
          updatedAt: new Date().toISOString(),
        };
        setConversation(working);
      };

      const streamSchedulerMessages = async (
        schedulerMessages: readonly AgentSchedulerMessage[],
        onDelta: (fullText: string) => void
      ): Promise<AgentSchedulerStreamResult> => {
        let started = false;
        let lastError = t("workflow.canvas.agentGenerateFailed");
        for (const model of modelsToTry) {
          if (controller.signal.aborted || userStopRef.current) {
            break;
          }
          const limits = contextLimitForModel(model);
          const trimmed = trimMessagesForContext({
            messages: schedulerMessagesToChat(schedulerMessages),
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
                    onDelta: (_delta, fullText) => {
                      started = true;
                      onDelta(fullText);
                    },
                  }
                ),
              {
                onStarted: handleStarted,
                onDelta: (_delta, fullText) => {
                  onDelta(fullText);
                },
              }
            );
            return { text: result.text, stopped: result.stopped };
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
        if (userStopRef.current || controller.signal.aborted) {
          return { text: "", stopped: true };
        }
        throw new Error(lastError);
      };

      try {
        const result = await runAgentScheduler({
          historyMessages: historyMessages.map((message) => ({
            role: message.role,
            content:
              message.role === "assistant"
                ? answerToHistoryContent(message.content)
                : message.content,
          })),
          isAborted: () => controller.signal.aborted || userStopRef.current,
          getMode: () => sessionModeRef.current,
          getCanvasInventory: readCanvasInventory,
          planDocument: working.planDocument,
          initialSideResults: options.initialSideResults,
          initialAnswer,
          stream: streamSchedulerMessages,
          runTool: (call) => runCanvasAgentTool(call),
          applyMode: (mode) => {
            sessionModeRef.current = mode;
            setSessionMode(mode);
            working = { ...working, sessionMode: mode };
            setConversation(working);
            if (mode === "plan") {
              setPlanPanelOpen(true);
            }
          },
          onAssistantContent: applyAssistantContent,
        });
        const talk = splitSavedAssistantContent(result.content).talk;
        const paused = Boolean(result.pendingAsk || result.pendingSwitch);
        working = {
          ...working,
          messages: working.messages.map((message) =>
            message.id === assistantId
              ? { ...message, content: result.content }
              : message
          ),
          consentedCapabilities: consentedRef.current,
          activeInvocationId: undefined,
          updatedAt: new Date().toISOString(),
        };
        if (!paused) {
          working = applyRunSessionState(working, talk);
        } else {
          working = {
            ...working,
            sessionMode: sessionModeRef.current,
          };
        }
        await applyConversation(working);
        invocationIdRef.current = null;
        setStreaming(false);
        setStreamStatus(
          result.stopped || userStopRef.current ? "stopped" : "idle"
        );
        if (result.pendingAsk) {
          setPendingAsk(result.pendingAsk);
        }
        if (result.pendingSwitch) {
          setConfirmKind("leave-plan");
        }
      } catch (error) {
        working = applyRunSessionState(
          { ...working, activeInvocationId: undefined },
          "",
          { preservePlan: sessionModeRef.current === "agent" }
        );
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
          setError(
            error instanceof Error
              ? error.message
              : t("workflow.canvas.agentGenerateFailed")
          );
        }
      }
    },
    [
      applyConversation,
      applyRunSessionState,
      cloudConfigured,
      cloudEnabled,
      consumeWithResume,
      readCanvasInventory,
      onRunNode,
      orgId,
      persistLocal,
      requestCapabilityConsent,
      resolveModelsToTry,
      runCanvasAgentTool,
      stopActiveGeneration,
      t,
      updateNodeData,
      workflowId,
      workflowName,
    ]
  );

  const resumeExisting = useCallback(
    async (base: LocalAgentConversation) => {
      const invocationId = base.activeInvocationId;
      if (!orgId || !invocationId) {
        return;
      }
      const last = base.messages[base.messages.length - 1];
      const assistantId = last?.role === "assistant" ? last.id : messageId();
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
      const seedAnswer = dropLiveTail(
        parseSavedAnswer(last?.role === "assistant" ? last.content : "")
      );

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
          const live = parseAgentSchedulerOutput(fullText, { complete: false });
          const content = composeSavedAnswer(
            mergeLiveSchedulerAnswer(seedAnswer, live)
          );
          working = {
            ...working,
            messages: working.messages.map((message) =>
              message.id === assistantId ? { ...message, content } : message
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
        const parsed = parseAgentSchedulerOutput(result.text, {
          complete: true,
        });
        const content = composeSavedAnswer(
          mergeLiveSchedulerAnswer(seedAnswer, parsed)
        );
        const talk = parsed.action === "talk" ? parsed.talk : "";
        const willContinueSide =
          parsed.action === "side" && !result.stopped && !userStopRef.current;
        working = {
          ...working,
          messages: working.messages.map((message) =>
            message.id === assistantId ? { ...message, content } : message
          ),
          sessionMode: sessionModeRef.current,
          activeInvocationId: undefined,
          updatedAt: new Date().toISOString(),
        };
        if (!willContinueSide) {
          working = applyRunSessionState(working, talk);
        }
        await applyConversation(working);
        invocationIdRef.current = null;
        setStreaming(false);
        setStreamStatus(result.stopped ? "stopped" : "idle");
        if (willContinueSide) {
          const sideResult = await runCanvasAgentTool(parsed.toolCall);
          if (userStopRef.current || abortRef.current?.signal.aborted) {
            working = applyRunSessionState(working, "", {
              preservePlan: sessionModeRef.current === "agent",
            });
            await applyConversation(working);
            setStreamStatus("stopped");
            return;
          }
          await persistLocal(working);
          setConversation(working);
          const filled = fillLastToolResult(
            parseSavedAnswer(
              working.messages.find((message) => message.id === assistantId)
                ?.content ?? ""
            ),
            sideResult
          );
          working = {
            ...working,
            messages: working.messages.map((message) =>
              message.id === assistantId
                ? { ...message, content: composeSavedAnswer(filled) }
                : message
            ),
          };
          await persistLocal(working);
          setConversation(working);
          await runGeneration(working, working.messages, {
            initialSideResults: [sideResult],
            continueLastAssistant: true,
          });
        }
      } catch {
        working = applyRunSessionState(
          { ...working, activeInvocationId: undefined },
          "",
          { preservePlan: sessionModeRef.current === "agent" }
        );
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
    [
      applyConversation,
      applyRunSessionState,
      consumeWithResume,
      orgId,
      persistLocal,
      runCanvasAgentTool,
      runGeneration,
      t,
    ]
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
      enterAskMode();
      setStreaming(false);
      setStreamStatus("stopped");
      return;
    }
    const last = conversation.messages[conversation.messages.length - 1];
    const messages =
      stoppedText !== undefined && last?.role === "assistant"
        ? conversation.messages.map((message) =>
            message.id === last.id
              ? {
                  ...message,
                  content: composeSavedAnswer(
                    mergeLiveSchedulerAnswer(
                      dropLiveTail(parseSavedAnswer(last.content)),
                      parseAgentSchedulerOutput(stoppedText, { complete: true })
                    )
                  ),
                }
              : message
          )
        : conversation.messages;
    const next = applyRunSessionState(
      {
        ...conversation,
        messages,
        activeInvocationId: undefined,
        updatedAt: new Date().toISOString(),
      },
      "",
      { preservePlan: sessionModeRef.current === "agent" }
    );
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
      sessionMode: sessionModeRef.current,
      title: titleFromMessages(nextMessages, conversation.title),
      updatedAt: new Date().toISOString(),
    };
    await persistLocal(next);
    setConversation(next);
    if (sessionModeRef.current === "agent") {
      setConfirmKind("execute");
      return;
    }
    await runGeneration(next, nextMessages);
  };

  const handleExecutePlan = async () => {
    if (!conversation || streaming) {
      return;
    }
    setConfirmKind(null);
    sessionModeRef.current = "agent";
    setSessionMode("agent");
    const next: LocalAgentConversation = {
      ...conversation,
      sessionMode: "agent",
      planPending: false,
      updatedAt: new Date().toISOString(),
    };
    await persistLocal(next);
    setConversation(next);
    setOpen(true);
    const last = next.messages[next.messages.length - 1];
    const continueLastAssistant = last?.role === "assistant";
    await runGeneration(next, next.messages, {
      continueLastAssistant,
    });
  };

  const handleConfirmAgentRun = async () => {
    if (!conversation || streaming) {
      return;
    }
    setConfirmKind(null);
    await runGeneration(conversation, conversation.messages);
  };

  const handleAnswerAsk = async (option: {
    readonly id: string;
    readonly label: string;
  }) => {
    if (!conversation || streaming || !pendingAsk) {
      return;
    }
    const last = conversation.messages[conversation.messages.length - 1];
    if (!last || last.role !== "assistant") {
      return;
    }
    const result = JSON.stringify({
      selected: option.id,
      label: option.label,
    });
    const filled = fillLastToolResult(parseSavedAnswer(last.content), result);
    const next: LocalAgentConversation = {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === last.id
          ? { ...message, content: composeSavedAnswer(filled) }
          : message
      ),
      updatedAt: new Date().toISOString(),
    };
    setPendingAsk(undefined);
    await persistLocal(next);
    setConversation(next);
    await runGeneration(next, next.messages, {
      initialSideResults: [result],
      continueLastAssistant: true,
    });
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
      sessionMode: sessionModeRef.current,
      title: titleFromMessages(nextMessages, conversation.title),
      updatedAt: new Date().toISOString(),
    };
    setResendIndex(null);
    setConfirmKind(null);
    setPendingAsk(undefined);
    await persistLocal(next);
    setConversation(next);
    if (sessionModeRef.current === "agent") {
      setConfirmKind("execute");
      return;
    }
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
      enterAskMode();
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
      enterAskMode();
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
    if ((confirmKind || isPlanRestriction(sessionModeRef.current)) && !draft.trim()) {
      if (confirmKind === "execute") {
        void handleConfirmAgentRun();
        return;
      }
      if (confirmKind === "leave-plan" || conversation?.planPending) {
        void handleExecutePlan();
        return;
      }
    }
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
  const planRestricted = isPlanRestriction(sessionMode);
  const planConfirmPending = isPlanConfirmPending({
    sessionMode,
    planPending: Boolean(conversation?.planPending),
    streaming,
  });
  const showConfirm =
    (Boolean(confirmKind) || planConfirmPending) && !streaming;
  const confirmIsLeavePlan = confirmKind === "leave-plan";
  const confirmIsAgentRun = confirmKind === "execute";
  const simpleAnimationActive = hasCapability(
    conversation?.consentedCapabilities,
    SIMPLE_ANIMATION_CAPABILITY
  );
  const statusLabel =
    streamStatus === "reconnecting"
      ? t("workflow.canvas.agentStatusReconnecting")
      : streamStatus === "stopped"
        ? t("workflow.canvas.agentStatusStopped")
        : showConfirm
          ? confirmIsLeavePlan
            ? t("workflow.canvas.agentLeavePlanHint")
            : t("workflow.canvas.agentStatusWaitingPlan")
          : null;

  return (
    <div
      className={cn(
        "relative flex items-start gap-2 transition-opacity duration-200",
        open && dimmed && "opacity-40"
      )}
    >
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
              <button
                type="button"
                onClick={() => onToggleRemotionViewport?.()}
                aria-pressed={remotionViewportOpen}
                aria-label={t("workflow.canvas.agentSimpleAnimation")}
                className={cn(
                  "relative inline-flex size-7 items-center justify-center rounded-md",
                  remotionViewportOpen
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                )}
              >
                <Clapperboard className="size-4" />
                {remotionViewportOpen ? (
                  <span
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-violet-500"
                    aria-hidden
                  />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!planRestricted) {
                    handleEnterPlan();
                    return;
                  }
                  setPlanPanelOpen((value) => !value);
                }}
                aria-pressed={planRestricted || planPanelOpen}
                aria-label={t("workflow.canvas.agentPlan")}
                className={cn(
                  "relative inline-flex size-7 items-center justify-center rounded-md",
                  planRestricted || planPanelOpen
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                )}
              >
                <List className="size-4" />
                {planRestricted || planPanelOpen ? (
                  <span
                    className="absolute top-1 right-1 size-1.5 rounded-full bg-violet-500"
                    aria-hidden
                  />
                ) : null}
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
                {turns.map((turn, turnIndex) => {
                  const isLastTurn = turnIndex === lastTurnIndex;
                  return (
                    <div key={turn.send.id} className="mb-4">
                      <HistoryUserMessage
                        content={turn.send.content}
                        disabled={streaming}
                        sendLabel={t("workflow.canvas.agentSend")}
                        onContentChange={(content) =>
                          handleUserContentChange(turn.send.id, content)
                        }
                        onSend={() => handleResendClick(turn.sendIndex)}
                        onKeyDown={(event) =>
                          handleHistoryKeyDown(event, turn.sendIndex)
                        }
                      />
                      <ThoughtBar
                        thinking={turn.answer.thinking}
                        live={
                          isLastTurn &&
                          isAgentThinkingLive({
                            streaming,
                            hasTalk: Boolean(turn.answer.talk),
                            hasTools: turn.answer.tools.length > 0,
                          })
                        }
                        thinkingLabel={t("workflow.canvas.agentStatusThinking")}
                        thoughtLabel={t("workflow.canvas.agentThought")}
                      />
                      {turn.answer.tools.map((tool) => (
                        <ToolBar
                          key={tool.id}
                          tool={tool}
                          running={
                            isLastTurn &&
                            streaming &&
                            !tool.result.trim()
                          }
                          toolLabel={t("workflow.canvas.agentToolCall")}
                        />
                      ))}
                      {isLastTurn && pendingAsk ? (
                        <AskCard
                          prompt={pendingAsk.prompt}
                          options={pendingAsk.options}
                          disabled={streaming}
                          onSelect={(option) => void handleAnswerAsk(option)}
                        />
                      ) : null}
                      {turn.answer.talk ? (
                        <div className="mt-2">
                          <div className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-100">
                            {turn.answer.talk}
                          </div>
                          <button
                            type="button"
                            className="mt-1 p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                            aria-label={t("workflow.canvas.agentCopy")}
                            onClick={() =>
                              void handleCopyAssistant(turn.answer.talk)
                            }
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      ) : null}
                      {isLastTurn && showConfirm ? (
                        <ConfirmStrip
                          kind={confirmIsLeavePlan ? "leave-plan" : "execute"}
                          leaveLabel={t("workflow.canvas.agentLeavePlan")}
                          runLabel={t("workflow.canvas.agentExecute")}
                          hint={
                            confirmIsLeavePlan
                              ? t("workflow.canvas.agentLeavePlanHint")
                              : t("workflow.canvas.agentExecuteHint")
                          }
                          disabled={streaming}
                          onLeave={handleLeavePlanToAsk}
                          onRun={() =>
                            void (confirmIsAgentRun
                              ? handleConfirmAgentRun()
                              : handleExecutePlan())
                          }
                        />
                      ) : null}
                      {isLastTurn && statusLabel ? (
                        <p className="mt-1 px-1 text-xs text-neutral-400">
                          {statusLabel}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                {error ? (
                  <p className="mb-2 text-xs text-red-600">{error}</p>
                ) : null}
                {showConfirm && turns.length === 0 ? (
                  <ConfirmStrip
                    kind={confirmIsLeavePlan ? "leave-plan" : "execute"}
                    leaveLabel={t("workflow.canvas.agentLeavePlan")}
                    runLabel={t("workflow.canvas.agentExecute")}
                    hint={
                      confirmIsLeavePlan
                        ? t("workflow.canvas.agentLeavePlanHint")
                        : t("workflow.canvas.agentExecuteHint")
                    }
                    disabled={streaming}
                    onLeave={handleLeavePlanToAsk}
                    onRun={() =>
                      void (confirmIsAgentRun
                        ? handleConfirmAgentRun()
                        : handleExecutePlan())
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <form
          className="p-2"
          autoComplete="off"
          onSubmit={(event) => void handleSendNew(event)}
        >
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
              onFocus={() => {
                setOpen(true);
                handleUndim();
              }}
              placeholder={t("workflow.canvas.agentInputPlaceholder")}
              autoComplete="off"
              className={cn(
                agentTextareaClassName,
                "thin-scrollbar placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              )}
              style={{ maxHeight: AGENT_EXPANDED_MAX_HEIGHT_PX }}
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <div className="flex min-w-0 items-center gap-1 pl-1">
                {contextUsage ? (
                  <AgentContextUsageRing
                    usage={contextUsage}
                    usageLabel={t("workflow.canvas.agentContextUsage", {
                      used: formatAgentContextTokenCount(contextUsage.used),
                      limit: formatAgentContextTokenCount(contextUsage.limit),
                    })}
                  />
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex min-w-0 max-w-[9rem] items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-white/10"
                      aria-label={t("workflow.canvas.agentSwitchModel")}
                    >
                      <span className="truncate">{selectedModelLabel}</span>
                      <ChevronDown className="size-3 shrink-0 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="max-h-64 overflow-y-auto thin-scrollbar"
                  >
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
                {planRestricted ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-200/80 py-0.5 pl-2 pr-1 text-xs text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                    {t("workflow.canvas.agentPlanChip")}
                    <button
                      type="button"
                      onClick={handleRequestLeavePlan}
                      aria-label={t("workflow.canvas.agentLeavePlan")}
                      className="inline-flex size-4 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-300/80 dark:hover:bg-white/10"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ) : null}
                {simpleAnimationActive ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f3eadf] py-0.5 pl-2 pr-1 text-xs text-[#8d6e4a] dark:bg-[#3a3228] dark:text-[#d4b896]">
                    <Clapperboard className="size-3.5" />
                    {t("workflow.canvas.agentSimpleAnimation")}
                    <button
                      type="button"
                      onClick={handleExitSimpleAnimation}
                      aria-label={t("workflow.canvas.agentSimpleAnimationExit")}
                      className="inline-flex size-4 items-center justify-center rounded-full text-[#8d6e4a]/80 hover:bg-[#8d6e4a]/10 dark:text-[#d4b896] dark:hover:bg-white/10"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ) : null}
              </div>
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

      {(Boolean(remotionViewportOpen && onCloseRemotionViewport) ||
        planPanelOpen) ? (
        <div
          className={cn(
            "flex min-h-0 flex-col gap-2",
            agentWidthClassName,
            open
              ? remotionCodeExpanded || planPanelOpen
                ? agentExpandedHeightClassName
                : undefined
              : "hidden"
          )}
        >
          {remotionViewportOpen && onCloseRemotionViewport ? (
            <Suspense
              fallback={
                <div
                  className={cn(
                    "nodrag nopan nowheel flex h-auto w-full shrink-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900",
                    remotionCodeExpanded && "min-h-0 flex-1"
                  )}
                  aria-hidden={!open}
                >
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <Clapperboard className="size-3.5 shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      {t("workflow.canvas.remotionViewportTitle")}
                    </span>
                  </div>
                  <div
                    className="flex flex-col items-center justify-center gap-2 bg-black text-neutral-400"
                    style={{ height: REMOTION_COMPACT_PREVIEW_HEIGHT_PX }}
                  >
                    <Spinner className="size-6 text-neutral-400" />
                    <span className="text-[11px]">
                      {t("workflow.canvas.remotionViewportLoading")}
                    </span>
                  </div>
                </div>
              }
            >
              <RemotionViewportOverlay
                organizationId={orgId}
                workflowId={workflowId}
                workflowName={workflowName}
                visible={open}
                onClose={onCloseRemotionViewport}
                embedded
                fillHeight={remotionCodeExpanded}
                codeExpanded={remotionCodeExpanded}
                onCodeExpandedChange={setRemotionCodeExpanded}
              />
            </Suspense>
          ) : null}
          {planPanelOpen ? (
            remotionViewportOpen && remotionCodeExpanded ? (
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-medium text-neutral-600 shadow-lg hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                onClick={() => setRemotionCodeExpanded(false)}
              >
                <List className="size-3.5" />
                {t("workflow.canvas.agentPlanPanel")}
              </button>
            ) : (
              <div className="nodrag nowheel flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
                  <List className="size-3.5 shrink-0 text-neutral-500" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    {t("workflow.canvas.agentPlanPanel")}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                    onClick={() => setPlanPanelOpen(false)}
                    aria-label={t("workflow.canvas.agentCollapse")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar px-3 py-2 text-sm whitespace-pre-wrap text-neutral-800 dark:text-neutral-100">
                  {conversation?.planDocument?.trim() ||
                    t("workflow.canvas.agentUntitled")}
                </div>
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {open && dimmed ? (
        <button
          type="button"
          className="absolute inset-0 z-50 cursor-default"
          aria-label={t("workflow.canvas.agentDialogTitle")}
          onClick={handleUndim}
        />
      ) : null}
    </div>
  );
});

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
            collapsedOverflows &&
              "agent-history-collapsed-fade overflow-hidden",
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

function ProcessToggle({
  label,
  open,
  onToggle,
}: {
  readonly label: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="mb-1 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
      aria-expanded={open}
      onClick={onToggle}
    >
      <ChevronDown
        className={cn("size-3 transition-transform", !open && "-rotate-90")}
      />
      {label}
    </button>
  );
}

function ThoughtBar({
  thinking,
  live,
  thinkingLabel,
  thoughtLabel,
}: {
  readonly thinking: string;
  readonly live: boolean;
  readonly thinkingLabel: string;
  readonly thoughtLabel: string;
}) {
  const hasThinking = thinking.trim().length > 0;
  const [open, setOpen] = useState(live);
  useEffect(() => {
    if (live) {
      setOpen(true);
    }
  }, [live]);
  if (!hasThinking && !live) {
    return null;
  }
  return (
    <div className="mt-2">
      <ProcessToggle
        label={live ? thinkingLabel : thoughtLabel}
        open={open}
        onToggle={() => setOpen((current) => !current)}
      />
      {open && hasThinking ? (
        <div className="mb-1 whitespace-pre-wrap text-xs text-neutral-500 dark:text-neutral-400">
          {thinking}
        </div>
      ) : null}
    </div>
  );
}

function ToolBar({
  tool,
  running,
  toolLabel,
}: {
  readonly tool: AgentChatToolCall;
  readonly running: boolean;
  readonly toolLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const label = tool.name.trim() || toolLabel;
  return (
    <div className="mt-1">
      <ProcessToggle
        label={running ? `${label}…` : label}
        open={open}
        onToggle={() => setOpen((current) => !current)}
      />
      {open && tool.result.trim() ? (
        <div className="mb-1 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-neutral-500 dark:text-neutral-400">
          {tool.result}
        </div>
      ) : null}
      {open && tool.args.trim() && !tool.result.trim() ? (
        <div className="mb-1 max-h-24 overflow-auto whitespace-pre-wrap text-xs text-neutral-500 dark:text-neutral-400">
          {tool.args}
        </div>
      ) : null}
    </div>
  );
}

function AskCard({
  prompt,
  options,
  disabled,
  onSelect,
}: {
  readonly prompt: string;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly disabled: boolean;
  readonly onSelect: (option: {
    readonly id: string;
    readonly label: string;
  }) => void;
}) {
  return (
    <div className="mt-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-800/80">
      <p className="text-sm text-neutral-800 dark:text-neutral-100">{prompt}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
            className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmStrip({
  kind,
  leaveLabel,
  runLabel,
  hint,
  disabled,
  onLeave,
  onRun,
}: {
  readonly kind: "leave-plan" | "execute";
  readonly leaveLabel: string;
  readonly runLabel: string;
  readonly hint: string;
  readonly disabled: boolean;
  readonly onLeave: () => void;
  readonly onRun: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-neutral-700 dark:bg-neutral-800/80">
      <p className="text-[11px] text-neutral-400">{hint}</p>
      <div className="ml-auto flex gap-1">
        {kind === "leave-plan" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onLeave}
            className="inline-flex shrink-0 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            {leaveLabel}
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={onRun}
          className="inline-flex shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-xs text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
        >
          {runLabel}
        </button>
      </div>
    </div>
  );
}

function dropLiveTail(answer: AgentChatAnswer): AgentChatAnswer {
  const last = answer.tools[answer.tools.length - 1];
  if (last && !last.result.trim()) {
    return { ...answer, tools: answer.tools.slice(0, -1) };
  }
  return answer;
}

function fillLastToolResult(
  answer: AgentChatAnswer,
  result: string
): AgentChatAnswer {
  const last = answer.tools[answer.tools.length - 1];
  if (!last || last.result.trim()) {
    return answer;
  }
  return {
    ...answer,
    tools: [...answer.tools.slice(0, -1), { ...last, result }],
  };
}

const CONTEXT_RING_SIZE = 14;
const CONTEXT_RING_STROKE = 1.75;
const CONTEXT_RING_RADIUS = (CONTEXT_RING_SIZE - CONTEXT_RING_STROKE) / 2;
const CONTEXT_RING_CIRCUMFERENCE = 2 * Math.PI * CONTEXT_RING_RADIUS;

function AgentContextUsageRing({
  usage,
  usageLabel,
  cacheHitPercent,
}: {
  readonly usage: AgentContextUsage;
  readonly usageLabel: string;
  readonly cacheHitPercent?: number;
}) {
  const { t } = useTranslation();
  const offset = CONTEXT_RING_CIRCUMFERENCE * (1 - usage.ratio);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 rounded-sm outline-none",
            usage.tone === "full" && "text-red-500",
            usage.tone === "warn" && "text-amber-500",
            usage.tone === "normal" && "text-neutral-400 dark:text-neutral-500"
          )}
          aria-label={usageLabel}
        >
          <svg
            width={CONTEXT_RING_SIZE}
            height={CONTEXT_RING_SIZE}
            viewBox={`0 0 ${CONTEXT_RING_SIZE} ${CONTEXT_RING_SIZE}`}
            className="-rotate-90"
          >
            <circle
              cx={CONTEXT_RING_SIZE / 2}
              cy={CONTEXT_RING_SIZE / 2}
              r={CONTEXT_RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={CONTEXT_RING_STROKE}
              className="opacity-25"
            />
            {usage.ratio > 0 ? (
              <circle
                cx={CONTEXT_RING_SIZE / 2}
                cy={CONTEXT_RING_SIZE / 2}
                r={CONTEXT_RING_RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={CONTEXT_RING_STROKE}
                strokeDasharray={CONTEXT_RING_CIRCUMFERENCE}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            ) : null}
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-auto min-w-[160px] p-2.5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">
            {t("workflow.canvas.agentContextLength")}
          </span>
          <span className="tabular-nums text-neutral-800 dark:text-neutral-200">
            {usageLabel}
          </span>
        </div>
        {typeof cacheHitPercent === "number" ? (
          <div className="mt-1.5 flex items-center justify-between gap-6 text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">
              {t("workflow.canvas.agentCacheHitRate")}
            </span>
            <span className="tabular-nums text-neutral-800 dark:text-neutral-200">
              {t("workflow.canvas.agentCacheHitValue", {
                percent: Math.round(cacheHitPercent),
              })}
            </span>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
