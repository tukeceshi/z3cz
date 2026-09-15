import {
  CHARACTER_LIBRARY_TABS,
  type CharacterLibraryCategory,
  type CharacterLibraryCharacter,
  type CharacterLibraryEntry,
  type CharacterLibraryTab,
  characterLibraryCategoryFromMime,
  characterLibraryCharacterCover,
  characterLibraryCharacterFromPublicGroup,
  characterLibraryCharacterWorkflowId,
  characterLibraryEntryCategory,
  characterLibraryEntryFromPublicPortrait,
  characterLibraryEntryWorkflowId,
  isCharacterLibraryCategory,
  PUBLIC_CHARACTER_LIBRARY_AGE_MAX,
  PUBLIC_CHARACTER_LIBRARY_AGE_MIN,
  PUBLIC_CHARACTER_LIBRARY_COUNTRIES,
  PUBLIC_CHARACTER_LIBRARY_GENDERS,
  type PublicCharacterLibraryGroup,
  type WorkflowMediaValue,
} from "@dafthunk/types";
import ChevronDownIcon from "lucide-react/icons/chevron-down";
import FolderPlusIcon from "lucide-react/icons/folder-plus";
import PlayIcon from "lucide-react/icons/play";
import PlusIcon from "lucide-react/icons/plus";
import RotateCcwIcon from "lucide-react/icons/rotate-ccw";
import Trash2Icon from "lucide-react/icons/trash-2";
import {
  type ButtonHTMLAttributes,
  forwardRef,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMediaDisplayUrlSet } from "@/hooks/use-media-display-url-set";
import type { TranslationKey } from "@/i18n";
import { listWorkflowCacheResources } from "@/services/ai-media-cache-service";
import {
  addCharacterLibraryCharacterItem,
  addCharacterLibraryEntry,
  createCharacterLibraryCharacter,
  deleteCharacterLibraryCharacter,
  fetchCharacterLibraryImportStatus,
  importCharacterLibraryEntry,
  listCharacterLibraryEntries,
  listPublicCharacterLibraryGroups,
  removeCharacterLibraryCharacterItem,
  removeCharacterLibraryEntry,
} from "@/services/character-library";
import { resolveMediaDisplay } from "@/services/media-display-readiness";
import { useWorkflows } from "@/services/workflow-service";
import { cn } from "@/utils/utils";

import { MediaDisplayLoadingPlaceholder } from "./media-display-loading-placeholder";
import { WorkflowMediaVideoPlayer } from "./workflow-media-video-player";

const CATEGORY_LABEL_KEY: Record<CharacterLibraryTab, TranslationKey> = {
  character: "workflow.characterLibrary.categoryCharacter",
  image: "workflow.characterLibrary.categoryImage",
  video: "workflow.characterLibrary.categoryVideo",
  audio: "workflow.characterLibrary.categoryAudio",
};

const PUBLIC_AGE_MARKS = [0, 20, 40, 60, 80, 100] as const;

const PublicLibraryFilterTrigger = forwardRef<
  HTMLButtonElement,
  {
    readonly label: string;
    readonly active: boolean;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function PublicLibraryFilterTrigger(
  { label, active, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      {label}
      <ChevronDownIcon className="size-3 opacity-70" />
    </button>
  );
});

function PublicLibraryFilters({
  gender,
  country,
  ageMin,
  ageMax,
  onGenderChange,
  onCountryChange,
  onAgeChange,
}: {
  readonly gender: string;
  readonly country: string;
  readonly ageMin: number;
  readonly ageMax: number;
  readonly onGenderChange: (value: string) => void;
  readonly onCountryChange: (value: string) => void;
  readonly onAgeChange: (min: number, max: number) => void;
}) {
  const { t } = useTranslation();
  const ageActive =
    ageMin > PUBLIC_CHARACTER_LIBRARY_AGE_MIN ||
    ageMax < PUBLIC_CHARACTER_LIBRARY_AGE_MAX;

  return (
    <div className="flex items-center rounded-lg border border-border/60 bg-background/85 p-0.5 shadow-sm backdrop-blur-sm">
      <Popover>
        <PopoverTrigger asChild>
          <PublicLibraryFilterTrigger
            label={
              gender === "all" ? t("workflow.characterLibrary.gender") : gender
            }
            active={gender !== "all"}
          />
        </PopoverTrigger>
        <PopoverContent align="end" className="z-[60] w-28 p-1">
          {(["all", ...PUBLIC_CHARACTER_LIBRARY_GENDERS] as const).map(
            (value) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "flex h-8 w-full items-center rounded-md px-2 text-left text-xs",
                  gender === value
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onGenderChange(value)}
              >
                {value === "all" ? t("workflow.characterLibrary.all") : value}
              </button>
            )
          )}
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <PublicLibraryFilterTrigger
            label={
              ageActive
                ? `${ageMin}-${ageMax}`
                : t("workflow.characterLibrary.age")
            }
            active={ageActive}
          />
        </PopoverTrigger>
        <PopoverContent align="end" className="z-[60] w-56 p-3">
          <div className="text-muted-foreground mb-3 text-xs">
            {ageMin}-{ageMax}
          </div>
          <Slider
            min={PUBLIC_CHARACTER_LIBRARY_AGE_MIN}
            max={PUBLIC_CHARACTER_LIBRARY_AGE_MAX}
            step={1}
            value={[ageMin, ageMax]}
            onValueChange={(next) => {
              const nextMin = next[0];
              const nextMax = next[1];
              if (nextMin === undefined || nextMax === undefined) {
                return;
              }
              onAgeChange(nextMin, nextMax);
            }}
          />
          <div className="text-muted-foreground mt-2 flex justify-between text-[10px]">
            {PUBLIC_AGE_MARKS.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <PublicLibraryFilterTrigger
            label={
              country === "all"
                ? t("workflow.characterLibrary.country")
                : country
            }
            active={country !== "all"}
          />
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="z-[60] max-h-72 w-40 overflow-y-auto p-1 thin-scrollbar"
        >
          <button
            type="button"
            className={cn(
              "flex h-8 w-full items-center rounded-md px-2 text-left text-xs",
              country === "all"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onCountryChange("all")}
          >
            {t("workflow.characterLibrary.all")}
          </button>
          {PUBLIC_CHARACTER_LIBRARY_COUNTRIES.map((value) => (
            <button
              key={value}
              type="button"
              className={cn(
                "flex h-8 w-full items-center rounded-md px-2 text-left text-xs",
                country === value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onCountryChange(value)}
            >
              {value}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

type LibraryPanel =
  | { readonly type: "create-character" }
  | { readonly type: "assign"; readonly entry: CharacterLibraryEntry }
  | { readonly type: "delete-entry"; readonly resourceId: string }
  | { readonly type: "delete-character"; readonly characterId: string }
  | {
      readonly type: "remove-member";
      readonly characterId: string;
      readonly resourceId: string;
    };

function mediaFromEntry(entry: CharacterLibraryEntry): WorkflowMediaValue {
  const previewUrl = entry.previewUrl?.trim();
  return {
    resourceId: entry.resourceId,
    kind: entry.kind,
    mimeType: entry.mimeType,
    ...(previewUrl ? { previewUrl } : {}),
  };
}

function CharacterLibraryCover({
  entry,
  hovered,
  playOnHover = true,
}: {
  readonly entry: CharacterLibraryEntry;
  readonly hovered: boolean;
  readonly playOnHover?: boolean;
}) {
  const media = useMemo(
    () => mediaFromEntry(entry),
    [entry.kind, entry.mimeType, entry.previewUrl, entry.resourceId]
  );
  const isVideo = entry.mimeType.startsWith("video/");
  const canPlay = playOnHover && isVideo && hovered;
  const { urlSet, stale } = useMediaDisplayUrlSet({
    media,
    nodeType: isVideo ? "ai-video" : "ai-image",
    preferredSize: "canvas-l",
    ensureSize: canPlay ? "full" : undefined,
  });
  const posterUrl =
    urlSet.l ?? urlSet.m ?? urlSet.s ?? (isVideo ? null : urlSet.full);
  const fullDisplay = useMemo(
    () =>
      resolveMediaDisplay({
        media: canPlay ? media : null,
        urlSet,
        size: "full",
        stale,
      }),
    [canPlay, media, stale, urlSet]
  );
  const videoUrl =
    fullDisplay.phase === "ready" ? fullDisplay.displayUrl : null;
  const showPlayer = Boolean(canPlay && videoUrl);
  const showHoverLoading = Boolean(
    canPlay && !videoUrl && fullDisplay.phase === "loading"
  );

  if (!posterUrl) {
    if (stale) {
      return (
        <MediaDisplayLoadingPlaceholder className="absolute inset-0 size-full" />
      );
    }
    return (
      <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[10px]">
        N/A
      </span>
    );
  }

  return (
    <>
      <img
        src={posterUrl}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover",
          showPlayer && "pointer-events-none opacity-0"
        )}
      />
      {playOnHover && isVideo && !showPlayer && !showHoverLoading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <PlayIcon className="h-8 w-8 text-white/85" strokeWidth={1.75} />
        </div>
      ) : null}
      {showPlayer && videoUrl ? (
        <WorkflowMediaVideoPlayer
          key={videoUrl}
          src={videoUrl}
          variant="card"
          objectFit="cover"
          initialHovered
          className="absolute inset-0 z-10"
        />
      ) : null}
      {showHoverLoading ? (
        <MediaDisplayLoadingPlaceholder className="absolute inset-0 z-10 size-full" />
      ) : null}
    </>
  );
}

function CardIconButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex size-6 items-center justify-center rounded bg-black/65 text-white backdrop-blur-[2px] hover:bg-black/80"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function CharacterLibraryItem({
  entry,
  picking,
  status,
  highlighted,
  onAdd,
  onInsert,
  onAssign,
  onRetry,
  onDelete,
}: {
  readonly entry: CharacterLibraryEntry;
  readonly picking: boolean;
  readonly status: "active" | "pending" | "failed" | undefined;
  readonly highlighted: boolean;
  readonly onAdd?: () => void;
  readonly onInsert: () => void;
  readonly onAssign?: () => void;
  readonly onRetry?: () => void;
  readonly onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-character-resource-id={entry.resourceId}
      className={cn(
        "group relative aspect-square w-full overflow-hidden rounded-xl border border-border",
        highlighted && "ring-2 ring-primary ring-offset-2"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CharacterLibraryCover entry={entry} hovered={hovered} />
      {status && !picking ? (
        <span
          className={cn(
            "absolute left-2 top-2 z-20 rounded px-1 py-px text-[9px] font-medium text-white",
            status === "active" && "bg-emerald-600",
            status === "pending" && "bg-amber-500",
            status === "failed" && "bg-destructive"
          )}
        >
          {status === "active"
            ? t("workflow.characterLibrary.statusActive")
            : status === "failed"
              ? t("workflow.characterLibrary.statusFailed")
              : t("workflow.characterLibrary.statusImporting")}
        </span>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-end justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        {picking ? (
          onAdd ? (
            <CardIconButton
              label={t("workflow.characterLibrary.add")}
              onClick={onAdd}
            >
              <PlusIcon className="size-3" />
            </CardIconButton>
          ) : null
        ) : (
          <>
            {status !== "pending" && status !== "failed" ? (
              <CardIconButton
                label={t("workflow.characterLibrary.insertToCanvas")}
                onClick={onInsert}
              >
                <PlusIcon className="size-3" />
              </CardIconButton>
            ) : null}
            {onAssign ? (
              <CardIconButton
                label={t("workflow.characterLibrary.addToCharacter")}
                onClick={onAssign}
              >
                <FolderPlusIcon className="size-3" />
              </CardIconButton>
            ) : null}
            {status === "failed" && onRetry ? (
              <CardIconButton
                label={t("workflow.characterLibrary.retryImport")}
                onClick={onRetry}
              >
                <RotateCcwIcon className="size-3" />
              </CardIconButton>
            ) : null}
            {onDelete ? (
              <CardIconButton
                label={t("workflow.characterLibrary.delete")}
                onClick={onDelete}
              >
                <Trash2Icon className="size-3" />
              </CardIconButton>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function CharacterFolderCard({
  character,
  highlighted,
  onOpen,
  onDelete,
}: {
  readonly character: CharacterLibraryCharacter;
  readonly highlighted: boolean;
  readonly onOpen: () => void;
  readonly onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const cover = characterLibraryCharacterCover(character.items);

  return (
    <div
      data-character-folder-id={character.id}
      className={cn(
        "group relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl border border-border text-left",
        highlighted && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onOpen}
    >
      {cover ? (
        <CharacterLibraryCover
          entry={cover}
          hovered={false}
          playOnHover={false}
        />
      ) : (
        <span className="text-muted-foreground absolute inset-0 flex items-center justify-center text-[10px]">
          N/A
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6">
        <span className="line-clamp-2 text-xs font-medium text-white">
          {character.name}
        </span>
      </div>
      {onDelete ? (
        <div className="absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100">
          <CardIconButton
            label={t("workflow.characterLibrary.delete")}
            onClick={onDelete}
          >
            <Trash2Icon className="size-3" />
          </CardIconButton>
        </div>
      ) : null}
    </div>
  );
}

interface CharacterLibraryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly organizationId: string;
  readonly interfaceId?: string;
  readonly libraryEnabled: boolean;
  readonly onInsert: (entry: CharacterLibraryEntry) => void;
}

/** Character candidates come only from the current canvas's AI media cache. */
async function loadCachedCanvasResources(params: {
  readonly organizationId: string;
  readonly workflowId?: string;
  readonly category: CharacterLibraryCategory;
}): Promise<readonly CharacterLibraryEntry[]> {
  if (!params.workflowId) {
    return [];
  }
  const rows = await listWorkflowCacheResources({
    organizationId: params.organizationId,
    workflowId: params.workflowId,
  });
  return rows
    .filter(
      (row) =>
        characterLibraryCategoryFromMime(row.mimeType) === params.category
    )
    .map((row) => ({
      resourceId: row.mediaId,
      kind: "cloud" as const,
      mimeType: row.mimeType,
      modelCanonicalId: null,
      interfaceId: null,
      createdAt: row.createdAt,
      workflowId: params.workflowId,
      category: params.category,
    }));
}

export function CharacterLibraryDialog({
  open,
  onOpenChange,
  organizationId,
  interfaceId,
  libraryEnabled,
  onInsert,
}: CharacterLibraryDialogProps) {
  const { t } = useTranslation();
  const { id: canvasWorkflowId } = useParams<{ id: string }>();
  const { workflows } = useWorkflows();
  const [entries, setEntries] = useState<readonly CharacterLibraryEntry[]>([]);
  const [characters, setCharacters] = useState<
    readonly CharacterLibraryCharacter[]
  >([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [available, setAvailable] = useState<readonly CharacterLibraryEntry[]>(
    []
  );
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(
    canvasWorkflowId ?? ""
  );
  const [selectedCategory, setSelectedCategory] =
    useState<CharacterLibraryTab>("character");
  const [openCharacterId, setOpenCharacterId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<LibraryPanel | null>(null);
  const [characterName, setCharacterName] = useState("");
  const [highlightedResourceId, setHighlightedResourceId] = useState<
    string | null
  >(null);
  const [highlightedCharacterId, setHighlightedCharacterId] = useState<
    string | null
  >(null);
  const [importingIds, setImportingIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [scope, setScope] = useState<"private" | "public">("private");
  const [publicGroups, setPublicGroups] = useState<
    readonly PublicCharacterLibraryGroup[]
  >([]);
  const [publicTotal, setPublicTotal] = useState(0);
  const [publicLoadingMore, setPublicLoadingMore] = useState(false);
  const [openPublicGroupId, setOpenPublicGroupId] = useState<string | null>(
    null
  );
  const [publicSearchInput, setPublicSearchInput] = useState("");
  const [publicSearch, setPublicSearch] = useState("");
  const [publicGender, setPublicGender] = useState("all");
  const [publicCountry, setPublicCountry] = useState("all");
  const [publicAgeMin, setPublicAgeMin] = useState(
    PUBLIC_CHARACTER_LIBRARY_AGE_MIN
  );
  const [publicAgeMax, setPublicAgeMax] = useState(
    PUBLIC_CHARACTER_LIBRARY_AGE_MAX
  );
  const [publicPage, setPublicPage] = useState(1);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);

  const mediaCategory = isCharacterLibraryCategory(selectedCategory)
    ? selectedCategory
    : null;

  const refreshPublic = async (page = 1, append = false) => {
    if (!organizationId) return;
    if (!append) {
      setPublicLoading(true);
      setPublicError(null);
    } else {
      setPublicLoadingMore(true);
    }
    try {
      const result = await listPublicCharacterLibraryGroups({
        organizationId,
        interfaceId,
        query: publicSearch.trim() || undefined,
        gender: publicGender,
        country: publicCountry,
        ageMin:
          publicAgeMin > PUBLIC_CHARACTER_LIBRARY_AGE_MIN ||
          publicAgeMax < PUBLIC_CHARACTER_LIBRARY_AGE_MAX
            ? publicAgeMin
            : undefined,
        ageMax:
          publicAgeMin > PUBLIC_CHARACTER_LIBRARY_AGE_MIN ||
          publicAgeMax < PUBLIC_CHARACTER_LIBRARY_AGE_MAX
            ? publicAgeMax
            : undefined,
        page,
      });
      setPublicTotal(result.total);
      setPublicPage(page);
      setPublicGroups((current) =>
        append ? [...current, ...result.groups] : result.groups
      );
    } catch (error) {
      if (!append) {
        setPublicGroups([]);
        setPublicTotal(0);
        setPublicError(
          error instanceof Error
            ? error.message
            : t("workflow.characterLibrary.loadFailed")
        );
      }
    } finally {
      setPublicLoading(false);
      setPublicLoadingMore(false);
    }
  };

  const refresh = async (
    workflowId = selectedWorkflowId,
    category: CharacterLibraryTab = selectedCategory
  ) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const cacheCategory = isCharacterLibraryCategory(category)
        ? category
        : "image";
      const [library, resources] = await Promise.all([
        listCharacterLibraryEntries({ organizationId, interfaceId }),
        category === "character"
          ? Promise.resolve([])
          : loadCachedCanvasResources({
              organizationId,
              workflowId,
              category: cacheCategory,
            }),
      ]);
      setEntries(library.entries);
      setCharacters(library.characters);
      setGroupId(library.groupId);
      if (category !== "character") {
        setAvailable(resources);
      }
    } catch {
      setEntries([]);
      setCharacters([]);
      setGroupId(null);
      setAvailable([]);
    } finally {
      setLoading(false);
    }
  };

  const resetView = () => {
    setPicking(false);
    setOpenCharacterId(null);
    setOpenPublicGroupId(null);
    setPanel(null);
    setCharacterName("");
    setHighlightedResourceId(null);
    setHighlightedCharacterId(null);
  };

  useEffect(() => {
    if (open) {
      const nextWorkflowId = canvasWorkflowId ?? "";
      setSelectedWorkflowId(nextWorkflowId);
      setSelectedCategory("character");
      setScope("private");
      setPublicGroups([]);
      setPublicTotal(0);
      setPublicSearchInput("");
      setPublicSearch("");
      setPublicGender("all");
      setPublicCountry("all");
      setPublicAgeMin(PUBLIC_CHARACTER_LIBRARY_AGE_MIN);
      setPublicAgeMax(PUBLIC_CHARACTER_LIBRARY_AGE_MAX);
      setPublicPage(1);
      setPublicError(null);
      setPublicLoading(false);
      resetView();
      void refresh(nextWorkflowId, "character");
      return;
    }
    resetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId, canvasWorkflowId]);

  useEffect(() => {
    if (!open || scope !== "public") {
      return;
    }
    setOpenPublicGroupId(null);
    setPublicLoading(true);
    const timer = setTimeout(() => {
      void refreshPublic(1, false);
    }, 200);
    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    organizationId,
    interfaceId,
    scope,
    publicSearch,
    publicGender,
    publicCountry,
    publicAgeMin,
    publicAgeMax,
  ]);

  useEffect(() => {
    if (!open || !organizationId || !selectedWorkflowId || !mediaCategory) {
      return;
    }
    let cancelled = false;
    void loadCachedCanvasResources({
      organizationId,
      workflowId: selectedWorkflowId,
      category: mediaCategory,
    }).then((rows) => {
      if (!cancelled) {
        setAvailable(rows);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, selectedWorkflowId, mediaCategory]);

  useEffect(() => {
    if (!open || !organizationId) return;
    const pendingIds = entries
      .filter((entry) => entry.upstreamAssetStatus === "pending")
      .map((entry) => entry.resourceId);
    if (pendingIds.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      for (const resourceId of pendingIds) {
        if (cancelled) return;
        try {
          const status = await fetchCharacterLibraryImportStatus({
            organizationId,
            resourceId,
          });
          setEntries((current) =>
            current.map((entry) =>
              entry.resourceId === resourceId
                ? { ...entry, upstreamAssetStatus: status }
                : entry
            )
          );
          setCharacters((current) =>
            current.map((character) => ({
              ...character,
              items: character.items.map((item) =>
                item.resourceId === resourceId
                  ? { ...item, upstreamAssetStatus: status }
                  : item
              ),
            }))
          );
        } catch {
          // Transient upstream errors: keep polling until it settles.
        }
      }
      if (!cancelled) {
        pollTimerRef.current = setTimeout(() => void poll(), 3000);
      }
    };
    pollTimerRef.current = setTimeout(() => void poll(), 3000);
    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [open, organizationId, entries]);

  const locateResource = (
    resourceId: string,
    workflowId?: string | null,
    category?: CharacterLibraryCategory | null
  ) => {
    const target = workflowId?.trim() || canvasWorkflowId || selectedWorkflowId;
    setPicking(false);
    setOpenCharacterId(null);
    if (target) {
      setSelectedWorkflowId(target);
    }
    if (category) {
      setSelectedCategory(category);
    }
    setHighlightedResourceId(resourceId);
  };

  useEffect(() => {
    if (!highlightedResourceId || picking) return;
    const root = gridScrollRef.current;
    const node = root?.querySelector(
      `[data-character-resource-id="${CSS.escape(highlightedResourceId)}"]`
    );
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const timer = window.setTimeout(() => setHighlightedResourceId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [
    highlightedResourceId,
    picking,
    selectedWorkflowId,
    selectedCategory,
    entries,
    openCharacterId,
  ]);

  useEffect(() => {
    if (!highlightedCharacterId || picking || openCharacterId) return;
    const root = gridScrollRef.current;
    const node = root?.querySelector(
      `[data-character-folder-id="${CSS.escape(highlightedCharacterId)}"]`
    );
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const timer = window.setTimeout(
      () => setHighlightedCharacterId(null),
      1600
    );
    return () => window.clearTimeout(timer);
  }, [
    highlightedCharacterId,
    picking,
    openCharacterId,
    selectedWorkflowId,
    characters,
  ]);

  const runImport = async (resourceId: string) => {
    if (!organizationId) return;
    setImportingIds((current) => new Set(current).add(resourceId));
    try {
      const updated = await importCharacterLibraryEntry({
        organizationId,
        resourceId,
      });
      setEntries((current) =>
        current.some((entry) => entry.resourceId === resourceId)
          ? current.map((entry) =>
              entry.resourceId === resourceId ? updated : entry
            )
          : [...current, updated]
      );
      setCharacters((current) =>
        current.map((character) => ({
          ...character,
          items: character.items.map((item) =>
            item.resourceId === resourceId ? updated : item
          ),
        }))
      );
    } catch {
      setEntries((current) =>
        current.map((entry) =>
          entry.resourceId === resourceId
            ? { ...entry, upstreamAssetStatus: "failed" }
            : entry
        )
      );
    } finally {
      setImportingIds((current) => {
        const next = new Set(current);
        next.delete(resourceId);
        return next;
      });
    }
  };

  const handleAdd = async (entry: CharacterLibraryEntry) => {
    const existing = entries.find(
      (item) => item.resourceId === entry.resourceId
    );
    if (existing) {
      locateResource(
        existing.resourceId,
        characterLibraryEntryWorkflowId(existing, canvasWorkflowId),
        characterLibraryEntryCategory(existing)
      );
      return;
    }
    const added = await addCharacterLibraryEntry({
      organizationId,
      resourceId: entry.resourceId,
      ...(interfaceId ? { interfaceId } : {}),
      ...(selectedWorkflowId ? { workflowId: selectedWorkflowId } : {}),
      ...(mediaCategory ? { category: mediaCategory } : {}),
    });
    const addedWorkflowId = characterLibraryEntryWorkflowId(
      added,
      canvasWorkflowId
    );
    const addedCategory = characterLibraryEntryCategory(added);
    setPicking(false);
    await refresh(
      addedWorkflowId ?? selectedWorkflowId,
      addedCategory ?? selectedCategory
    );
    locateResource(added.resourceId, addedWorkflowId, addedCategory);
    const alreadyImported =
      added.upstreamAssetStatus === "active" ||
      added.upstreamAssetStatus === "pending" ||
      added.upstreamAssetStatus === "failed";
    if (!alreadyImported) {
      void runImport(added.resourceId);
    }
  };

  const handleRemove = async (resourceId: string) => {
    await removeCharacterLibraryEntry({ organizationId, resourceId });
    setPanel(null);
    await refresh();
  };

  const handleCreateCharacter = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const created = await createCharacterLibraryCharacter({
      organizationId,
      name: trimmed,
      ...(selectedWorkflowId ? { workflowId: selectedWorkflowId } : {}),
    });
    setCharacters((current) => [created, ...current]);
    return created;
  };

  const handleSubmitCreateCharacter = async () => {
    const created = await handleCreateCharacter(characterName);
    if (!created) return;
    setPanel(null);
    setCharacterName("");
    setSelectedCategory("character");
    setOpenCharacterId(null);
    setHighlightedCharacterId(created.id);
  };

  const handleAssignToCharacter = async (characterId: string) => {
    if (panel?.type !== "assign") return;
    await addCharacterLibraryCharacterItem({
      organizationId,
      characterId,
      resourceId: panel.entry.resourceId,
    });
    setPanel(null);
    setCharacterName("");
    await refresh();
  };

  const handleAssignToNewCharacter = async () => {
    if (panel?.type !== "assign") return;
    const created = await handleCreateCharacter(characterName);
    if (!created) return;
    await addCharacterLibraryCharacterItem({
      organizationId,
      characterId: created.id,
      resourceId: panel.entry.resourceId,
    });
    setPanel(null);
    setCharacterName("");
    await refresh();
  };

  const handleDeleteCharacter = async (characterId: string) => {
    await deleteCharacterLibraryCharacter({ organizationId, characterId });
    if (openCharacterId === characterId) {
      setOpenCharacterId(null);
    }
    setPanel(null);
    await refresh();
  };

  const handleRemoveMember = async (
    characterId: string,
    resourceId: string
  ) => {
    await removeCharacterLibraryCharacterItem({
      organizationId,
      characterId,
      resourceId,
    });
    setPanel(null);
    await refresh();
  };

  const visibleEntries = entries.filter((entry) => {
    const workflowMatch =
      characterLibraryEntryWorkflowId(entry, canvasWorkflowId) ===
      selectedWorkflowId;
    return (
      workflowMatch &&
      mediaCategory !== null &&
      characterLibraryEntryCategory(entry) === mediaCategory
    );
  });
  const visibleCharacters = characters.filter(
    (character) =>
      characterLibraryCharacterWorkflowId(character, canvasWorkflowId) ===
      selectedWorkflowId
  );
  const openCharacter =
    visibleCharacters.find((character) => character.id === openCharacterId) ??
    null;
  const openPublicGroup =
    publicGroups.find((group) => group.groupId === openPublicGroupId) ?? null;
  const nestedView = Boolean(picking || openCharacter || openPublicGroup);
  const assignCharacters = visibleCharacters;
  const visible = picking
    ? available.filter(
        (entry) => characterLibraryEntryCategory(entry) === mediaCategory
      )
    : openCharacter
      ? openCharacter.items
      : visibleEntries;
  const showCharacterFolders =
    selectedCategory === "character" && !picking && !openCharacter;
  const showEmpty = !loading && picking && visible.length === 0;

  const workflowOptions = useMemo(() => {
    const ids = new Set<string>();
    if (canvasWorkflowId) {
      ids.add(canvasWorkflowId);
    }
    if (selectedWorkflowId) {
      ids.add(selectedWorkflowId);
    }
    for (const entry of entries) {
      const id = characterLibraryEntryWorkflowId(entry, canvasWorkflowId);
      if (id) {
        ids.add(id);
      }
    }
    for (const character of characters) {
      const id = characterLibraryCharacterWorkflowId(
        character,
        canvasWorkflowId
      );
      if (id) {
        ids.add(id);
      }
    }
    return [...ids];
  }, [canvasWorkflowId, characters, entries, selectedWorkflowId]);

  const workflowNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const workflow of workflows) {
      names.set(
        workflow.id,
        workflow.name.trim() || t("pages.workflows.untitled")
      );
    }
    return names;
  }, [t, workflows]);

  const workflowLabel = (workflowId: string): string =>
    workflowNameById.get(workflowId) ?? workflowId;

  const closePrompt = () => {
    setPanel(null);
    setCharacterName("");
  };

  const promptOpen =
    panel?.type === "create-character" || panel?.type === "assign";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && promptOpen) {
            return;
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent className="flex h-[min(720px,calc(100vh-2rem))] w-[min(1000px,calc(100vw-2rem))] max-w-[1000px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
            <div className="flex min-w-0 items-center gap-3">
              {nestedView ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => {
                    setScope((current) =>
                      current === "private" ? "public" : "private"
                    );
                    setPicking(false);
                    setOpenCharacterId(null);
                    setOpenPublicGroupId(null);
                    setPanel(null);
                  }}
                >
                  {scope === "private"
                    ? t("workflow.characterLibrary.publicTitle")
                    : t("workflow.characterLibrary.title")}
                </Button>
              )}
              <DialogTitle className="text-sm font-medium">
                {picking
                  ? t("workflow.characterLibrary.addFromExisting")
                  : openCharacter
                    ? openCharacter.name
                    : openPublicGroup
                      ? openPublicGroup.name
                      : scope === "public"
                        ? t("workflow.characterLibrary.publicTitle")
                        : t("workflow.characterLibrary.title")}
              </DialogTitle>
              {scope === "private" && libraryEnabled ? (
                <div className="flex items-center gap-1">
                  {CHARACTER_LIBRARY_TABS.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={cn(
                        "rounded-md px-2 py-1 text-xs",
                        selectedCategory === category &&
                          "bg-muted text-foreground",
                        selectedCategory !== category &&
                          "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => {
                        setSelectedCategory(category);
                        setPicking(false);
                        setOpenCharacterId(null);
                        setPanel(null);
                      }}
                    >
                      {t(CATEGORY_LABEL_KEY[category])}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <DialogDescription className="sr-only">
              {t("workflow.characterLibrary.title")}
            </DialogDescription>
            {nestedView ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPicking(false);
                  setOpenCharacterId(null);
                  setOpenPublicGroupId(null);
                }}
              >
                {openCharacter || openPublicGroup
                  ? t("workflow.characterLibrary.backToCharacters")
                  : t("workflow.characterLibrary.backToList")}
              </Button>
            ) : null}
          </div>

          <TooltipProvider delayDuration={0}>
            {scope === "public" && !openPublicGroup ? (
              <div className="shrink-0 px-4 pt-3">
                <SearchInput
                  id="character-library-public-search"
                  name="character_library_public_search"
                  autoComplete="off"
                  className="h-9 text-sm"
                  placeholder={t("workflow.characterLibrary.searchPlaceholder")}
                  value={publicSearchInput}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPublicSearchInput(next);
                    if (publicSearch && next.trim() === "") {
                      setPublicSearch("");
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }
                    event.preventDefault();
                    setPublicSearch(publicSearchInput.trim());
                  }}
                />
              </div>
            ) : null}
            <div className="relative min-h-0 flex-1">
              {scope === "public" && !openPublicGroup ? (
                <div className="pointer-events-none absolute right-4 top-3 z-10">
                  <div className="pointer-events-auto">
                    <PublicLibraryFilters
                      gender={publicGender}
                      country={publicCountry}
                      ageMin={publicAgeMin}
                      ageMax={publicAgeMax}
                      onGenderChange={setPublicGender}
                      onCountryChange={setPublicCountry}
                      onAgeChange={(min, max) => {
                        setPublicAgeMin(min);
                        setPublicAgeMax(max);
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <div
                ref={gridScrollRef}
                className="h-full overflow-y-auto p-4 thin-scrollbar"
              >
                {scope === "public" ? (
                  <div className="flex h-full min-h-0 flex-col">
                    {publicLoading ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center">
                        <MediaDisplayLoadingPlaceholder className="h-8 w-8" />
                      </div>
                    ) : publicError ? (
                      <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm">
                        {publicError}
                      </div>
                    ) : publicGroups.length === 0 ? (
                      <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center px-8 text-center text-sm">
                        {t("workflow.characterLibrary.publicEmpty")}
                      </div>
                    ) : openPublicGroup ? (
                      <div className="grid grid-cols-4 gap-2">
                        {openPublicGroup.items.map((item) => {
                          const entry =
                            characterLibraryEntryFromPublicPortrait(item);
                          if (!entry) {
                            return null;
                          }
                          return (
                            <CharacterLibraryItem
                              key={entry.resourceId}
                              entry={entry}
                              picking={false}
                              status={undefined}
                              highlighted={false}
                              onInsert={() => {
                                onInsert(entry);
                                onOpenChange(false);
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {publicGroups.map((group) => (
                          <CharacterFolderCard
                            key={group.groupId}
                            character={characterLibraryCharacterFromPublicGroup(
                              group
                            )}
                            highlighted={false}
                            onOpen={() => setOpenPublicGroupId(group.groupId)}
                          />
                        ))}
                        {publicGroups.length < publicTotal ? (
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground col-span-4 h-9 rounded-md text-xs"
                            disabled={publicLoadingMore}
                            onClick={() =>
                              void refreshPublic(publicPage + 1, true)
                            }
                          >
                            {publicLoadingMore
                              ? t("common.loading")
                              : t("workflow.characterLibrary.loadMore")}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : loading ? (
                  <div className="flex h-full items-center justify-center">
                    <MediaDisplayLoadingPlaceholder className="h-8 w-8" />
                  </div>
                ) : scope === "private" && !libraryEnabled ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center px-8 text-center text-sm">
                    {t("workflow.characterLibrary.privateDisabledHint")}
                  </div>
                ) : showEmpty ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    {t("workflow.characterLibrary.availableEmpty")}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {picking || openCharacter ? null : (
                      <button
                        type="button"
                        className="bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-border px-4 text-center text-sm transition"
                        onClick={() => {
                          if (selectedCategory === "character") {
                            setCharacterName("");
                            setPanel({ type: "create-character" });
                            return;
                          }
                          setPicking(true);
                        }}
                      >
                        <PlusIcon className="size-6" />
                        {selectedCategory === "character"
                          ? t("workflow.characterLibrary.createCharacter")
                          : t("workflow.characterLibrary.addFromExisting")}
                      </button>
                    )}
                    {showCharacterFolders
                      ? visibleCharacters.map((character) => (
                          <CharacterFolderCard
                            key={character.id}
                            character={character}
                            highlighted={
                              highlightedCharacterId === character.id
                            }
                            onOpen={() => setOpenCharacterId(character.id)}
                            onDelete={() =>
                              setPanel({
                                type: "delete-character",
                                characterId: character.id,
                              })
                            }
                          />
                        ))
                      : visible.map((entry) => {
                          const isImporting = importingIds.has(
                            entry.resourceId
                          );
                          const status =
                            entry.upstreamAssetStatus ??
                            (isImporting ? "pending" : undefined);
                          return (
                            <CharacterLibraryItem
                              key={entry.resourceId}
                              entry={entry}
                              picking={picking}
                              status={status}
                              highlighted={
                                highlightedResourceId === entry.resourceId
                              }
                              onAdd={() => void handleAdd(entry)}
                              onInsert={() => {
                                onInsert(entry);
                                onOpenChange(false);
                              }}
                              onAssign={
                                picking || openCharacter
                                  ? undefined
                                  : () => {
                                      setCharacterName("");
                                      setPanel({ type: "assign", entry });
                                    }
                              }
                              onRetry={() => void runImport(entry.resourceId)}
                              onDelete={() =>
                                setPanel(
                                  openCharacter
                                    ? {
                                        type: "remove-member",
                                        characterId: openCharacter.id,
                                        resourceId: entry.resourceId,
                                      }
                                    : {
                                        type: "delete-entry",
                                        resourceId: entry.resourceId,
                                      }
                                )
                              }
                            />
                          );
                        })}
                  </div>
                )}
              </div>
            </div>
          </TooltipProvider>

          {panel?.type === "delete-entry" ? (
            <div className="border-destructive/40 bg-destructive/5 shrink-0 border-t px-4 py-3 text-sm">
              <p className="font-medium">
                {t("workflow.characterLibrary.deleteConfirmTitle")}
              </p>
              <p className="text-muted-foreground mt-1">
                {t("workflow.characterLibrary.deleteConfirmDescription")}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPanel(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleRemove(panel.resourceId)}
                >
                  {t("workflow.characterLibrary.delete")}
                </Button>
              </div>
            </div>
          ) : panel?.type === "delete-character" ? (
            <div className="border-destructive/40 bg-destructive/5 shrink-0 border-t px-4 py-3 text-sm">
              <p className="font-medium">
                {t("workflow.characterLibrary.deleteCharacterTitle")}
              </p>
              <p className="text-muted-foreground mt-1">
                {t("workflow.characterLibrary.deleteCharacterDescription")}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPanel(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleDeleteCharacter(panel.characterId)}
                >
                  {t("workflow.characterLibrary.delete")}
                </Button>
              </div>
            </div>
          ) : panel?.type === "remove-member" ? (
            <div className="border-destructive/40 bg-destructive/5 shrink-0 border-t px-4 py-3 text-sm">
              <p className="font-medium">
                {t("workflow.characterLibrary.removeFromCharacterTitle")}
              </p>
              <p className="text-muted-foreground mt-1">
                {t("workflow.characterLibrary.removeFromCharacterDescription")}
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPanel(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void handleRemoveMember(panel.characterId, panel.resourceId)
                  }
                >
                  {t("workflow.characterLibrary.delete")}
                </Button>
              </div>
            </div>
          ) : scope === "private" && libraryEnabled ? (
            <div className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-t px-4">
              <span className="text-muted-foreground min-w-0 truncate text-xs">
                {t("workflow.characterLibrary.assetGroupId")}
                {groupId
                  ? `：${groupId}`
                  : `：${t("workflow.characterLibrary.groupNotCreated")}`}
              </span>
              {selectedWorkflowId ? (
                <Select
                  value={selectedWorkflowId}
                  onValueChange={(value) => {
                    setPicking(false);
                    setOpenCharacterId(null);
                    setSelectedWorkflowId(value);
                  }}
                >
                  <SelectTrigger
                    aria-label={t("workflow.characterLibrary.workflow")}
                    className="h-8 w-[200px] shrink-0 text-xs"
                  >
                    <SelectValue
                      placeholder={t("workflow.characterLibrary.workflow")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowOptions.map((workflowId) => (
                      <SelectItem key={workflowId} value={workflowId}>
                        {workflowLabel(workflowId)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={panel?.type === "create-character"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closePrompt();
          }
        }}
      >
        <DialogContent className="z-[70] max-w-sm gap-3 sm:rounded-lg">
          <DialogTitle className="text-sm font-medium">
            {t("workflow.characterLibrary.createCharacter")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("workflow.characterLibrary.characterNamePlaceholder")}
          </DialogDescription>
          <Input
            id="character-library-character-name"
            name="character_library_character_name"
            autoComplete="off"
            autoFocus
            placeholder={t(
              "workflow.characterLibrary.characterNamePlaceholder"
            )}
            value={characterName}
            onChange={(event) => setCharacterName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSubmitCreateCharacter();
              }
            }}
          />
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={closePrompt}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!characterName.trim()}
              onClick={() => void handleSubmitCreateCharacter()}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={panel?.type === "assign"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closePrompt();
          }
        }}
      >
        <DialogContent className="z-[70] max-w-sm gap-3 sm:rounded-lg">
          <DialogTitle className="text-sm font-medium">
            {t("workflow.characterLibrary.addToCharacter")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("workflow.characterLibrary.addToCharacter")}
          </DialogDescription>
          {assignCharacters.length > 0 ? (
            <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
              {assignCharacters.map((character) => (
                <Button
                  key={character.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => void handleAssignToCharacter(character.id)}
                >
                  {character.name}
                </Button>
              ))}
            </div>
          ) : null}
          <Input
            id="character-library-assign-name"
            name="character_library_assign_name"
            autoComplete="off"
            placeholder={t(
              "workflow.characterLibrary.characterNamePlaceholder"
            )}
            value={characterName}
            onChange={(event) => setCharacterName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAssignToNewCharacter();
              }
            }}
          />
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={closePrompt}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!characterName.trim()}
              onClick={() => void handleAssignToNewCharacter()}
            >
              {t("workflow.characterLibrary.createCharacter")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
