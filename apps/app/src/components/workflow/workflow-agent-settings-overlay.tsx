import type {
  AgentChatDirectoryEntry,
  AgentChatMessage,
  AgentChatToolCall,
  AiGenerativeNodeType,
  OrgTextModelOption,
} from "@dafthunk/types";
import { AI_TEXT_NODE_TYPE } from "@dafthunk/types";
import {
  answerBlocks,
  conversationHasMessages,
  dropUnfinishedAnswerTool,
  fillLastAnswerToolResult,
  fingerprintAgentChatBody,
  titleFromMessages,
  withAnswerStepIfNew,
} from "@dafthunk/types";
import type {
  Connection,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
} from "@xyflow/react";
import ArrowUp from "lucide-react/icons/arrow-up";
import ChevronDown from "lucide-react/icons/chevron-down";
import Clapperboard from "lucide-react/icons/clapperboard";
import Copy from "lucide-react/icons/copy";
import History from "lucide-react/icons/history";
import Paperclip from "lucide-react/icons/paperclip";
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
  ASK_QUESTION_TOOL,
  CANVAS_MAKE_CAPABILITY,
  isMakeTool,
  SIMPLE_ANIMATION_TOOL,
} from "@/services/agent-capabilities";
import {
  compactCanvasAgentState,
  executeCanvasAgentTool,
  formatCanvasInventory,
  toolCallFromFunctionArgs,
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
  type AgentSchedulerToolCall,
  composeSavedAnswer,
  parseAskQuestionArgs,
  parseSavedAnswer,
  runAgentScheduler,
  schedulerMessagesToChat,
  unansweredPendingWriteFromAnswer,
  unansweredAskToolFromAnswer,
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
  modeOnOpenConversation,
  SIMPLE_ANIMATION_CAPABILITY,
  stateAfterRun,
  withoutWriteConsent,
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
  nextAgentEventState,
  shouldShowTalkCopy,
  resolveAgentContextModel,
  selectableTextModelsInOrder,
  shouldFetchSealedAgentChatBody,
  shouldSubmitAgentChatOnEnter,
  splitLastUserTurn,
  trimMessagesForContext,
} from "./agent-chat-utils";
import {
  isNearScrollBottom,
  scrollContainerToBottom,
} from "./ai-text-preview-scroll";
import { AgentTalkCite } from "./agent-talk-cite";
import { findAgentReferenceConnection, generationModeToNodeType } from "./agent-canvas-connect";
import {
  filterMentionNodes,
  insertMention,
  mentionQueryAtCaret,
  type AgentMentionNode,
} from "./agent-composer-mentions";
import { useCloudStorageCanvasContext } from "./cloud-storage-canvas-provider";
import { commitAiTextValue } from "./commit-ai-text-value";
import type { GenerativeNodeAddOptions } from "./creative-studio-context";
import { validateWorkflowConnection } from "./workflow-connection-validation";
import { createPatchNodeLayoutMetadata } from "./patch-node-layout-metadata";
import { updateNodeInput, useWorkflow } from "./workflow-context";
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

async function waitForCanvasNode(
  getGraph: () => {
    readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
    readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
  },
  nodeId: string
): Promise<{
  readonly nodes: readonly ReactFlowNode<WorkflowNodeType>[];
  readonly edges: readonly ReactFlowEdge<WorkflowEdgeType>[];
}> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const latest = getGraph();
    if (latest.nodes.some((node) => node.id === nodeId)) {
      return latest;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 16);
    });
  }
  return getGraph();
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
  readonly onCreateGenerativeNode?: (
    nodeType: AiGenerativeNodeType,
    options?: GenerativeNodeAddOptions
  ) => string | null;
  readonly onConnectWorkflow?: (connection: Connection) => void;
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
    onCreateGenerativeNode,
    onConnectWorkflow,
  },
  ref
) {
  const { t, locale } = useTranslation();
  const {
    updateNodeData,
    onRunNode,
    generativeReferenceCatalogs,
    disabled: workflowDisabled,
  } = useWorkflow();
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
  const [hasStepTalk, setHasStepTalk] = useState(false);
  const [streamStatus, setStreamStatus] = useState<AgentStreamStatus>("idle");
  const [resendIndex, setResendIndex] = useState<number | null>(null);
  const [sessionMode, setSessionMode] = useState<AgentSessionMode>("ask");
  const [pendingAsk, setPendingAsk] = useState<AgentAskQuestion | undefined>();
  const [pendingAnimationWrite, setPendingAnimationWrite] = useState(false);
  const [canvasReferences, setCanvasReferences] = useState<
    readonly AgentMentionNode[]
  >([]);
  const [attachments, setAttachments] = useState<
    readonly {
      readonly id: string;
      readonly name: string;
      readonly mimeType: string;
      readonly url: string;
    }[]
  >([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      for (const item of attachments) {
        URL.revokeObjectURL(item.url);
      }
    };
    // Only revoke leftover previews when the overlay unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup
  }, []);
  const [remotionCodeExpanded, setRemotionCodeExpanded] = useState(false);
  const [citeRevealLine, setCiteRevealLine] = useState<number | undefined>(
    undefined
  );
  const abortRef = useRef<AbortController | null>(null);
  const userStopRef = useRef(false);
  const generationSeqRef = useRef(0);
  const invocationIdRef = useRef<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sessionModeRef = useRef<AgentSessionMode>("ask");
  const consentedRef = useRef<string[]>([]);
  const draftSourceRef = useRef<string | undefined>(undefined);

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
    draftSourceRef.current = conversation?.draftSourceCode;
    setPendingAsk(conversation?.pendingAsk);
    const messages = conversation?.messages;
    const lastMessage = messages?.[messages.length - 1];
    const unansweredWrite =
      lastMessage?.role === "assistant"
        ? unansweredPendingWriteFromAnswer(
            parseSavedAnswer(lastMessage.content)
          )
        : undefined;
    setPendingAnimationWrite(
      Boolean(conversation?.pendingAnimationWrite) || Boolean(unansweredWrite)
    );
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

  const clearWriteConsent = useCallback(() => {
    const next = withoutWriteConsent(consentedRef.current);
    consentedRef.current = [...next];
    return next;
  }, []);

  const requestCapabilityConsent = useCallback(
    async (capabilityId: string) => {
      if (capabilityId === SIMPLE_ANIMATION_CAPABILITY) {
        openRemotionViewport();
      }
      return {
        authorized: false,
        open: true,
      };
    },
    [openRemotionViewport]
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
      setPendingAsk(undefined);
      setPendingAnimationWrite(false);
      const writeConsent = withoutWriteConsent(consentedRef.current);
      consentedRef.current = [...writeConsent];
      return {
        ...current,
        sessionMode: after.sessionMode,
        planPending: after.planPending,
        planDocument: after.planDocument,
        draftSourceCode: draftSourceRef.current,
        pendingAsk: undefined,
        pendingAnimationWrite: undefined,
        consentedCapabilities: writeConsent,
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
          showViewport: openRemotionViewport,
          hideViewport: onCloseRemotionViewport,
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
            const latest = getCanvasGraph?.() ?? graph;
            const current = latest.nodes.find((node) => node.id === nodeId);
            if (!current) {
              return { ok: false, error: "找不到节点" };
            }
            if (current.data.nodeType === AI_TEXT_NODE_TYPE) {
              if (!orgId || !workflowId) {
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
            }
            updateNodeInput(
              nodeId,
              "prompt",
              text,
              current.data.inputs,
              updateNodeData
            );
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
            const latest = getCanvasGraph?.() ?? graph;
            const current = latest.nodes.find((node) => node.id === nodeId);
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
          createGenerationFlow: async (input) => {
            if (!onCreateGenerativeNode) {
              return { ok: false, error: "无法创建节点" };
            }
            const nodeId = onCreateGenerativeNode(
              generationModeToNodeType(input.mode),
              {
                prompt: input.prompt,
                precedingText: "",
                ...(input.x !== undefined && input.y !== undefined
                  ? { positionFlowPoint: { x: input.x, y: input.y } }
                  : {}),
              }
            );
            if (!nodeId) {
              return { ok: false, error: "无法创建节点" };
            }
            const latest = await waitForCanvasNode(
              () => getCanvasGraph?.() ?? graph,
              nodeId
            );
            for (const fromNodeId of input.referenceNodeIds) {
              const connection = findAgentReferenceConnection({
                fromNodeId,
                toNodeId: nodeId,
                nodes: latest.nodes,
              });
              if (!connection || !onConnectWorkflow) {
                continue;
              }
              if (
                !validateWorkflowConnection({
                  connection,
                  nodes: latest.nodes,
                  edges: latest.edges,
                  generativeReferenceCatalogs,
                  disabled: workflowDisabled,
                })
              ) {
                continue;
              }
              onConnectWorkflow(connection);
            }
            if (input.autoRun) {
              if (!onRunNode) {
                return { ok: false, nodeId, error: "无法运行该节点" };
              }
              await onRunNode(nodeId);
            }
            return { ok: true, nodeId };
          },
          connectNodes: async (connections) => {
            if (!onConnectWorkflow) {
              return { ok: false, error: "无法连线" };
            }
            let latest = getCanvasGraph?.() ?? graph;
            for (const item of connections) {
              if (
                !latest.nodes.some((node) => node.id === item.toNodeId) ||
                !latest.nodes.some((node) => node.id === item.fromNodeId)
              ) {
                latest = await waitForCanvasNode(
                  () => getCanvasGraph?.() ?? graph,
                  item.toNodeId
                );
                if (
                  !latest.nodes.some((node) => node.id === item.fromNodeId)
                ) {
                  latest = await waitForCanvasNode(
                    () => getCanvasGraph?.() ?? graph,
                    item.fromNodeId
                  );
                }
              }
              const connection = findAgentReferenceConnection({
                fromNodeId: item.fromNodeId,
                toNodeId: item.toNodeId,
                nodes: latest.nodes,
              });
              if (!connection) {
                return { ok: false, error: "无法连线" };
              }
              if (
                !validateWorkflowConnection({
                  connection,
                  nodes: latest.nodes,
                  edges: latest.edges,
                  generativeReferenceCatalogs,
                  disabled: workflowDisabled,
                })
              ) {
                return { ok: false, error: "无法连线" };
              }
              onConnectWorkflow(connection);
            }
            return { ok: true };
          },
        },
      });
    },
    [
      cloudConfigured,
      generativeReferenceCatalogs,
      getCanvasGraph,
      onConnectWorkflow,
      onCreateGenerativeNode,
      onRunNode,
      openRemotionViewport,
      onCloseRemotionViewport,
      orgId,
      requestCapabilityConsent,
      revokeCapabilityConsent,
      updateNodeData,
      workflowDisabled,
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

  const canSend =
    (draft.trim().length > 0 || attachments.length > 0) &&
    !streaming &&
    Boolean(orgId);

  const persistLocal = useCallback(
    async (next: LocalAgentConversation) => {
      if (!orgId || !workflowId) {
        return;
      }
      const merged: LocalAgentConversation = {
        ...next,
        draftSourceCode: draftSourceRef.current,
      };
      if (conversationHasMessages({ messages: merged.messages })) {
        await writeLocalAgentConversation({
          organizationId: orgId,
          workflowId,
          workflowName: workflowName || workflowId,
          conversation: merged,
        });
      }
      await writeLastOpenAgentConversationId({
        organizationId: orgId,
        workflowId,
        conversationId: merged.id,
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
      const merged = {
        ...next,
        draftSourceCode: draftSourceRef.current,
      };
      setConversation(merged);
      await persistLocal(merged);
      scheduleCloudSync(merged);
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
        readonly onDelta: (
          delta: string,
          fullText: string,
          fullThinking?: string
        ) => void;
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
        readonly initialToolResults?: readonly string[];
        readonly continueLastAssistant?: boolean;
        readonly pendingToolCalls?: readonly AgentSchedulerToolCall[];
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
            if (!options.continueLastAssistant) {
              const last = historyMessages[historyMessages.length - 1];
              if (last?.role === "user") {
                const rolled: LocalAgentConversation = {
                  ...base,
                  messages: historyMessages.slice(0, -1),
                  updatedAt: new Date().toISOString(),
                };
                await persistLocal(rolled);
                setConversation(rolled);
              }
            }
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
      const generationSeq = generationSeqRef.current + 1;
      generationSeqRef.current = generationSeq;
      userStopRef.current = false;
      invocationIdRef.current = null;
      setStreaming(true);
      setHasStepTalk(false);
      setStreamStatus("generating");
      setError(null);
      setPendingAsk(undefined);
      setPendingAnimationWrite(false);

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
      const writeConsent = continuing
        ? consentedRef.current
        : clearWriteConsent();
      let working: LocalAgentConversation = {
        ...base,
        messages: continuing
          ? historyMessages
          : [
              ...historyMessages,
              { id: assistantId, role: "assistant", content: "" },
            ],
        title: base.eventTitle?.trim() || titleFromMessages(historyMessages, base.title),
        updatedAt: new Date().toISOString(),
        activeInvocationId: undefined,
        pendingAsk: undefined,
        pendingAnimationWrite: undefined,
        pendingEventSplit: undefined,
        consentedCapabilities: writeConsent,
      };
      setConversation(working);

      const handleStarted = (id: string) => {
        invocationIdRef.current = id;
        working = {
          ...working,
          activeInvocationId: id,
          draftSourceCode: draftSourceRef.current,
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
          draftSourceCode: draftSourceRef.current,
          updatedAt: new Date().toISOString(),
        };
        setConversation(working);
      };

      const streamSchedulerMessages = async (
        schedulerMessages: readonly AgentSchedulerMessage[],
        tools: readonly {
          readonly type: "function";
          readonly function: {
            readonly name: string;
            readonly description: string;
            readonly parameters: unknown;
          };
        }[],
        onDelta: (fullText: string, fullThinking?: string) => void
      ): Promise<AgentSchedulerStreamResult> => {
        setHasStepTalk(false);
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
                      toolCallId: message.toolCallId,
                      toolCalls: message.toolCalls,
                    })),
                    tools,
                  },
                  {
                    signal: controller.signal,
                    onStarted: (id) => {
                      started = true;
                      handleStarted(id);
                    },
                    onDelta: (_delta, fullText, fullThinking) => {
                      started = true;
                      setHasStepTalk(Boolean(fullText.trim()));
                      onDelta(fullText, fullThinking);
                    },
                  }
                ),
              {
                onStarted: handleStarted,
                onDelta: (_delta, fullText, fullThinking) => {
                  setHasStepTalk(Boolean(fullText.trim()));
                  onDelta(fullText, fullThinking);
                },
              }
            );
            return {
              text: result.text,
              thinking: result.thinking,
              toolCalls: result.toolCalls,
              stopped: result.stopped,
            };
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
            content: message.content,
          })),
          isAborted: () => controller.signal.aborted || userStopRef.current,
          getMode: () => sessionModeRef.current,
          getCanvasInventory: readCanvasInventory,
          previousEvent:
            base.eventEnded === undefined
              ? undefined
              : {
                  title: base.eventTitle?.trim() || base.title || "未命名",
                  ended: base.eventEnded,
                },
          locale,
          initialToolResults: options.initialToolResults,
          initialAnswer,
          pendingToolCalls: options.pendingToolCalls,
          stream: streamSchedulerMessages,
          runTool: (call) => runCanvasAgentTool(call),
          applyMode: (mode) => {
            sessionModeRef.current = mode;
            setSessionMode(mode);
            working = { ...working, sessionMode: mode };
            setConversation(working);
          },
          onAssistantContent: applyAssistantContent,
        });
        const talk = splitSavedAssistantContent(result.content).talk;
        const paused = Boolean(
          result.pendingAsk || result.pendingAnimationWrite
        );
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
          if (result.eventJudged) {
            working = {
              ...working,
              ...nextAgentEventState({
                title: working.title,
                eventTitle: result.eventTitle,
                eventEnded: result.eventEnded,
                previousEventTitle: base.eventTitle,
                previousEventEnded: base.eventEnded,
              }),
            };
          }
        } else {
          working = {
            ...working,
            sessionMode: sessionModeRef.current,
            pendingAsk: result.pendingAsk,
            pendingAnimationWrite: result.pendingAnimationWrite,
          };
        }
        if (result.pendingAsk) {
          setPendingAsk(result.pendingAsk);
        }
        if (result.pendingAnimationWrite) {
          setPendingAnimationWrite(true);
        }
        if (generationSeq !== generationSeqRef.current) {
          return;
        }
        await applyConversation(working);
        invocationIdRef.current = null;
        setStreaming(false);
        setHasStepTalk(false);
        setStreamStatus(
          result.stopped || userStopRef.current ? "stopped" : "idle"
        );
      } catch (error) {
        if (generationSeq !== generationSeqRef.current) {
          return;
        }
        working = applyRunSessionState(
          { ...working, activeInvocationId: undefined },
          "",
          { preservePlan: sessionModeRef.current === "real" }
        );
        await persistLocal(working);
        setConversation(working);
        invocationIdRef.current = null;
        setStreaming(false);
        setHasStepTalk(false);
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
      clearWriteConsent,
      cloudConfigured,
      cloudEnabled,
      consumeWithResume,
      readCanvasInventory,
      onRunNode,
      locale,
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
      const seedAnswer = dropUnfinishedAnswerTool(
        parseSavedAnswer(last?.role === "assistant" ? last.content : "")
      );

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const generationSeq = generationSeqRef.current + 1;
      generationSeqRef.current = generationSeq;
      userStopRef.current = false;
      invocationIdRef.current = base.activeInvocationId;
      setStreaming(true);
      setHasStepTalk(false);
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
        const handleDelta = (
          _delta: string,
          fullText: string,
          fullThinking = ""
        ) => {
          setHasStepTalk(Boolean(fullText.trim()));
          const content = composeSavedAnswer(
            withAnswerStepIfNew(seedAnswer, fullThinking, fullText)
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
        const stepped = withAnswerStepIfNew(
          seedAnswer,
          result.thinking,
          result.text
        );
        const talk = stepped.talk;
        const content = composeSavedAnswer(stepped);
        const pendingToolCalls = result.toolCalls.filter((call) =>
          call.name.trim()
        );
        const willContinue =
          pendingToolCalls.length > 0 &&
          !result.stopped &&
          !userStopRef.current;
        working = {
          ...working,
          messages: working.messages.map((message) =>
            message.id === assistantId ? { ...message, content } : message
          ),
          sessionMode: sessionModeRef.current,
          activeInvocationId: undefined,
          updatedAt: new Date().toISOString(),
        };
        if (!willContinue) {
          working = applyRunSessionState(working, talk);
        }
        if (generationSeq !== generationSeqRef.current) {
          return;
        }
        await applyConversation(working);
        invocationIdRef.current = null;
        if (!willContinue) {
          setStreaming(false);
          setHasStepTalk(false);
          setStreamStatus(result.stopped ? "stopped" : "idle");
          return;
        }
        await runGeneration(working, working.messages, {
          continueLastAssistant: true,
          pendingToolCalls,
        });
      } catch {
        if (generationSeq !== generationSeqRef.current) {
          return;
        }
        working = applyRunSessionState(
          { ...working, activeInvocationId: undefined },
          "",
          { preservePlan: sessionModeRef.current === "real" }
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
        setHasStepTalk(false);
      }
    },
    [
      applyConversation,
      applyRunSessionState,
      consumeWithResume,
      orgId,
      persistLocal,
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
      setHasStepTalk(false);
      setStreamStatus("stopped");
      return;
    }
    const last = conversation.messages[conversation.messages.length - 1];
    const kept =
      last?.role === "assistant"
        ? dropUnfinishedAnswerTool(parseSavedAnswer(last.content))
        : undefined;
    const messages =
      stoppedText !== undefined && last?.role === "assistant" && kept
        ? conversation.messages.map((message) =>
            message.id === last.id
              ? {
                  ...message,
                  content: composeSavedAnswer(
                    withAnswerStepIfNew(kept, "", stoppedText)
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
      { preservePlan: sessionModeRef.current === "real" }
    );
    invocationIdRef.current = null;
    await applyConversation(next);
    setStreaming(false);
    setHasStepTalk(false);
    setStreamStatus("stopped");
  };

  const mentionNodes = useMemo((): readonly AgentMentionNode[] => {
    const graph = getCanvasGraph?.() ?? { nodes: [], edges: [] };
    return graph.nodes.map((node) => ({
      id: node.id,
      name: node.data.name || node.id,
      type: node.data.nodeType ?? node.type ?? "",
    }));
  }, [getCanvasGraph, conversation?.updatedAt]);

  const activeMention = mentionQueryAtCaret(
    draft,
    composerTextareaRef.current?.selectionStart ?? draft.length
  );
  const mentionChoices = activeMention
    ? filterMentionNodes(mentionNodes, activeMention.query)
    : [];

  const handleDraftChange = (value: string, caret?: number) => {
    setDraft(value);
    const mention = mentionQueryAtCaret(value, caret ?? value.length);
    setMentionOpen(Boolean(mention));
    setMentionIndex(0);
  };

  const handlePickMention = (node: AgentMentionNode) => {
    const caret = composerTextareaRef.current?.selectionStart ?? draft.length;
    const mention = mentionQueryAtCaret(draft, caret);
    if (!mention) {
      return;
    }
    const next = insertMention(draft, caret, mention, node);
    handleDraftChange(next.text, next.caret);
    setCanvasReferences((current) =>
      current.some((item) => item.id === node.id) ? current : [...current, node]
    );
    setMentionOpen(false);
    requestAnimationFrame(() => {
      const textarea = composerTextareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleAddFiles = (files: readonly File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      return;
    }
    setAttachments((current) => [
      ...current,
      ...images.map((file) => ({
        id: messageId(),
        name: file.name || "image",
        mimeType: file.type || "image/png",
        url: URL.createObjectURL(file),
      })),
    ]);
    setOpen(true);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((current) => {
      const match = current.find((item) => item.id === id);
      if (match) {
        URL.revokeObjectURL(match.url);
      }
      return current.filter((item) => item.id !== id);
    });
  };

  const composeOutgoingContent = (text: string): string => {
    const parts = [text.trim()];
    if (canvasReferences.length > 0) {
      parts.push(
        `引用节点：\n${canvasReferences
          .map((node) => `- ${node.id} ${node.name} (${node.type})`)
          .join("\n")}`
      );
    }
    if (attachments.length > 0) {
      parts.push(
        `本轮图片：\n${attachments
          .map((item) => `- ${item.id} ${item.mimeType} ${item.url}`)
          .join("\n")}`
      );
    }
    return parts.filter((part) => part.length > 0).join("\n\n");
  };

  const handleSendNew = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend || !conversation) {
      return;
    }
    stickToBottomRef.current = true;
    const content = composeOutgoingContent(draft);
    setDraft("");
    setMentionOpen(false);
    setCanvasReferences([]);
    setAttachments([]);
    const last = conversation.messages[conversation.messages.length - 1];
    const cancelledWrite =
      pendingAnimationWrite && last?.role === "assistant"
        ? fillLastAnswerToolResult(
            parseSavedAnswer(last.content),
            JSON.stringify({ cancelled: true })
          )
        : undefined;
    const historyMessages =
      cancelledWrite && last
        ? conversation.messages.map((message) =>
            message.id === last.id
              ? { ...message, content: composeSavedAnswer(cancelledWrite) }
              : message
          )
        : conversation.messages;
    setPendingAnimationWrite(false);
    const userMessage: AgentChatMessage = {
      id: messageId(),
      role: "user",
      content,
    };
    const nextMessages = [...historyMessages, userMessage];
    const next: LocalAgentConversation = {
      ...conversation,
      messages: nextMessages,
      sessionMode: sessionModeRef.current,
      title:
        conversation.eventTitle?.trim() ||
        titleFromMessages(nextMessages, conversation.title),
      pendingAnimationWrite: undefined,
      pendingEventSplit: undefined,
      updatedAt: new Date().toISOString(),
    };
    await persistLocal(next);
    setConversation(next);
    await runGeneration(next, nextMessages);
  };

  const handleAnswerAsk = async (option: {
    readonly id: string;
    readonly label: string;
  }) => {
    if (!conversation || streaming) {
      return;
    }
    const target = [...conversation.messages]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          unansweredAskToolFromAnswer(parseSavedAnswer(message.content))
      );
    if (!target) {
      return;
    }
    const result = JSON.stringify({
      selected: option.id,
      label: option.label,
    });
    const filled = fillLastAnswerToolResult(
      parseSavedAnswer(target.content),
      result
    );
    const next: LocalAgentConversation = {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === target.id
          ? { ...message, content: composeSavedAnswer(filled) }
          : message
      ),
      draftSourceCode: draftSourceRef.current,
      pendingAsk: undefined,
      updatedAt: new Date().toISOString(),
    };
    const last = conversation.messages[conversation.messages.length - 1];
    setPendingAsk(undefined);
    await persistLocal(next);
    setConversation(next);
    await runGeneration(next, next.messages, {
      continueLastAssistant: last?.id === target.id,
    });
  };

  const handleConfirmAnimationWrite = async () => {
    if (!conversation || streaming) {
      return;
    }
    const last = conversation.messages[conversation.messages.length - 1];
    if (last?.role !== "assistant") {
      setPendingAnimationWrite(false);
      return;
    }
    const parsed = parseSavedAnswer(last.content);
    const tool = unansweredPendingWriteFromAnswer(parsed);
    if (!tool) {
      setPendingAnimationWrite(false);
      return;
    }
    const nextConsented = new Set(consentedRef.current);
    if (tool.name === SIMPLE_ANIMATION_TOOL || tool.name.startsWith("remotion_")) {
      nextConsented.add(SIMPLE_ANIMATION_CAPABILITY);
      openRemotionViewport();
    }
    if (isMakeTool(tool.name)) {
      nextConsented.add(CANVAS_MAKE_CAPABILITY);
      patchSessionMode("real");
    }
    if (nextConsented.size !== consentedRef.current.length) {
      patchConsentedCapabilities([...nextConsented]);
    }
    const result = await runCanvasAgentTool(
      toolCallFromFunctionArgs(tool.name, tool.args)
    );
    const filled = fillLastAnswerToolResult(parsed, result);
    const next: LocalAgentConversation = {
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === last.id
          ? { ...message, content: composeSavedAnswer(filled) }
          : message
      ),
      consentedCapabilities: consentedRef.current,
      pendingAnimationWrite: undefined,
      draftSourceCode: draftSourceRef.current,
      updatedAt: new Date().toISOString(),
    };
    setPendingAnimationWrite(false);
    await persistLocal(next);
    setConversation(next);
    await runGeneration(next, next.messages, {
      continueLastAssistant: true,
    });
  };

  const handleConfirmEventSplit = async () => {
    if (!orgId || !workflowId || !conversation || streaming) {
      return;
    }
    const pending = conversation.pendingEventSplit;
    const { kept, moved } = splitLastUserTurn(conversation.messages);
    if (!pending || moved.length === 0) {
      const cleared: LocalAgentConversation = {
        ...conversation,
        pendingEventSplit: undefined,
        updatedAt: new Date().toISOString(),
      };
      await applyConversation(cleared);
      return;
    }
    const oldConversation: LocalAgentConversation = {
      ...conversation,
      messages: kept,
      pendingEventSplit: undefined,
      updatedAt: new Date().toISOString(),
    };
    await flushCloudSync(oldConversation);
    const opened = createEmptyLocalConversation({
      organizationId: orgId,
      workflowId,
    });
    const next: LocalAgentConversation = {
      ...opened,
      title:
        pending.title?.trim() ||
        titleFromMessages(moved, conversation.title),
      messages: moved,
      eventTitle: pending.title,
      eventEnded: pending.ended,
      sessionMode: "ask",
    };
    const openNext = async (conversationId: string) => {
      const created: LocalAgentConversation = {
        ...next,
        id: conversationId,
      };
      await writeLocalAgentConversation({
        organizationId: orgId,
        workflowId,
        workflowName: workflowName || workflowId,
        conversation: oldConversation,
      });
      enterAskMode();
      await applyConversation(created);
      await refreshHistory();
    };
    try {
      const result = await switchAgentChat(orgId, {
        workflowId,
        currentConversationId: conversation.id,
        currentTitle: oldConversation.title,
        currentBody: { messages: kept },
      });
      if (result.inUse) {
        setBusyId(result.current.id);
        await refreshHistory();
        return;
      }
      await openNext(result.current.id);
    } catch {
      await openNext(opened.id);
    }
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
      title:
        conversation.eventTitle?.trim() ||
        titleFromMessages(nextMessages, conversation.title),
      pendingEventSplit: undefined,
      updatedAt: new Date().toISOString(),
    };
    setResendIndex(null);
    setPendingAsk(undefined);
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
    generationSeqRef.current += 1;
    userStopRef.current = true;
    abortRef.current?.abort();
    await stopActiveGeneration();
    setStreaming(false);
    setHasStepTalk(false);
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
    generationSeqRef.current += 1;
    userStopRef.current = true;
    abortRef.current?.abort();
    await stopActiveGeneration();
    setStreaming(false);
    setHasStepTalk(false);
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
    if (mentionOpen && mentionChoices.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((index) => (index + 1) % mentionChoices.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (index) => (index - 1 + mentionChoices.length) % mentionChoices.length
        );
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const choice = mentionChoices[mentionIndex];
        if (choice) {
          handlePickMention(choice);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
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
    if (pendingAnimationWrite && !draft.trim()) {
      void handleConfirmAnimationWrite();
      return;
    }
    if (conversation?.pendingEventSplit && !draft.trim()) {
      void handleConfirmEventSplit();
      return;
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
  const storedAsk = pendingAsk ?? conversation?.pendingAsk;
  const visibleAsk =
    storedAsk && storedAsk.options.length === 0
      ? parseAskQuestionArgs(storedAsk.prompt) ?? storedAsk
      : storedAsk;
  const showAnimationConfirm =
    pendingAnimationWrite && !streaming && !visibleAsk;
  const showEventSplitConfirm =
    Boolean(conversation?.pendingEventSplit) &&
    !streaming &&
    !visibleAsk &&
    !showAnimationConfirm;
  const showConfirm = showAnimationConfirm || showEventSplitConfirm;
  const simpleAnimationActive = hasCapability(
    conversation?.consentedCapabilities,
    SIMPLE_ANIMATION_CAPABILITY
  );
  const statusLabel =
    streamStatus === "reconnecting"
      ? t("workflow.canvas.agentStatusReconnecting")
      : streamStatus === "stopped"
        ? t("workflow.canvas.agentStatusStopped")
        : null;
  const confirmStrip = (
    <ConfirmStrip
      kind="execute"
      leaveLabel={t("workflow.canvas.agentLeavePlan")}
      runLabel={t("workflow.canvas.agentExecute")}
      hint={
        showEventSplitConfirm
          ? t("workflow.canvas.agentEventEndHint")
          : t("workflow.canvas.agentExecuteHint")
      }
      disabled={streaming}
      onLeave={() => undefined}
      onRun={() =>
        void (showEventSplitConfirm
          ? handleConfirmEventSplit()
          : handleConfirmAnimationWrite())
      }
    />
  );

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
                  const thinkingLive =
                    isLastTurn &&
                    isAgentThinkingLive({
                      streaming,
                      hasStepTalk,
                    });
                  const blocks = answerBlocks(turn.answer);
                  const lastBlock = blocks[blocks.length - 1];
                  const liveThoughtAtEnd =
                    thinkingLive && lastBlock?.kind !== "think";
                  const askedInBlocks = blocks.some(
                    (block) =>
                      block.kind === "tool" &&
                      block.tool.name === ASK_QUESTION_TOOL &&
                      !block.tool.result.trim()
                  );
                  const lastTalkIndex = blocks.reduce(
                    (found, block, index) =>
                      block.kind === "talk" ? index : found,
                    -1
                  );
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
                      {blocks.map((block, blockIndex) => {
                        if (block.kind === "think") {
                          return (
                            <ThoughtBar
                              key={`think-${blockIndex}`}
                              thinking={block.text}
                              live={
                                thinkingLive &&
                                blockIndex === blocks.length - 1
                              }
                              thinkingLabel={t(
                                "workflow.canvas.agentStatusThinking"
                              )}
                              thoughtLabel={t("workflow.canvas.agentThought")}
                            />
                          );
                        }
                        if (block.kind === "tool") {
                          if (
                            block.tool.name === ASK_QUESTION_TOOL &&
                            isLastTurn &&
                            visibleAsk &&
                            !block.tool.result.trim()
                          ) {
                            return (
                              <AskCard
                                key={block.tool.id}
                                prompt={visibleAsk.prompt}
                                options={visibleAsk.options}
                                disabled={streaming}
                                onSelect={(option) =>
                                  void handleAnswerAsk(option)
                                }
                              />
                            );
                          }
                          return (
                            <ToolBar
                              key={block.tool.id}
                              tool={block.tool}
                              running={
                                isLastTurn &&
                                streaming &&
                                !block.tool.result.trim()
                              }
                              toolLabel={t("workflow.canvas.agentToolCall")}
                            />
                          );
                        }
                        if (
                          isLastTurn &&
                          visibleAsk &&
                          parseAskQuestionArgs(block.text)
                        ) {
                          return null;
                        }
                        return (
                          <div key={`talk-${blockIndex}`} className="mt-2">
                            <AgentTalkCite
                              talk={block.text}
                              onOpenCite={(cite) => {
                                setCiteRevealLine(cite.startLine);
                                setRemotionCodeExpanded(true);
                                openRemotionViewport();
                              }}
                            />
                            {shouldShowTalkCopy({
                              streaming,
                              isLastTurn,
                              isLastTalk: blockIndex === lastTalkIndex,
                            }) ? (
                              <button
                                type="button"
                                className="mt-1 p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                                aria-label={t("workflow.canvas.agentCopy")}
                                onClick={() =>
                                  void handleCopyAssistant(block.text)
                                }
                              >
                                <Copy className="size-3.5" />
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                      {isLastTurn && visibleAsk && !askedInBlocks ? (
                        <AskCard
                          prompt={visibleAsk.prompt}
                          options={visibleAsk.options}
                          disabled={streaming}
                          onSelect={(option) => void handleAnswerAsk(option)}
                        />
                      ) : null}
                      {liveThoughtAtEnd ? (
                        <ThoughtBar
                          thinking=""
                          live
                          thinkingLabel={t(
                            "workflow.canvas.agentStatusThinking"
                          )}
                          thoughtLabel={t("workflow.canvas.agentThought")}
                        />
                      ) : null}
                      {isLastTurn && showConfirm ? confirmStrip : null}
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
                {showConfirm && turns.length === 0 ? confirmStrip : null}
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
            {canvasReferences.length > 0 || attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1 px-3 pt-2">
                {canvasReferences.map((node) => (
                  <span
                    key={node.id}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-200/70 px-2 py-0.5 text-xs text-neutral-700 dark:bg-white/10 dark:text-neutral-200"
                  >
                    @{node.name}
                    <button
                      type="button"
                      onClick={() =>
                        setCanvasReferences((current) =>
                          current.filter((item) => item.id !== node.id)
                        )
                      }
                      className="inline-flex size-3.5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                      aria-label={node.name}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {attachments.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-200/70 px-2 py-0.5 text-xs text-neutral-700 dark:bg-white/10 dark:text-neutral-200"
                  >
                    {item.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(item.id)}
                      className="inline-flex size-3.5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                      aria-label={item.name}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative">
              {mentionOpen && mentionChoices.length > 0 ? (
                <div className="absolute inset-x-2 bottom-full z-20 mb-1 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                  {mentionChoices.map((node, index) => (
                    <button
                      key={node.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs",
                        index === mentionIndex
                          ? "bg-neutral-100 dark:bg-neutral-800"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handlePickMention(node);
                      }}
                    >
                      <span className="truncate text-neutral-800 dark:text-neutral-100">
                        {node.name}
                      </span>
                      <span className="ml-2 shrink-0 text-neutral-400">
                        {node.type}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <textarea
                ref={composerTextareaRef}
                id="workflow-agent-composer"
                name="agent_composer_draft"
                rows={1}
                value={draft}
                onChange={(event) =>
                  handleDraftChange(
                    event.target.value,
                    event.target.selectionStart
                  )
                }
                onPaste={(event) => {
                  const files = Array.from(event.clipboardData.files);
                  if (files.some((file) => file.type.startsWith("image/"))) {
                    event.preventDefault();
                    handleAddFiles(files);
                  }
                }}
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
            </div>
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <div className="flex min-w-0 items-center gap-1 pl-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    handleAddFiles(Array.from(event.target.files ?? []));
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800 dark:hover:bg-white/10 dark:hover:text-neutral-100"
                  aria-label={t("workflow.canvas.agentAttachImage")}
                >
                  <Paperclip className="size-3.5" />
                </button>
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

      {remotionViewportOpen && onCloseRemotionViewport ? (
        <div
          className={cn(
            "flex min-h-0 flex-col gap-2",
            agentWidthClassName,
            open
              ? remotionCodeExpanded
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
                revealLine={citeRevealLine}
              />
            </Suspense>
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
    setOpen(live);
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
      {options.length > 0 ? (
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
      ) : null}
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
