import DeleteKey from "lucide-react/icons/delete";
import Keyboard from "lucide-react/icons/keyboard";
import X from "lucide-react/icons/x";
import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { ActionBarButton } from "@/components/ui/action-bar";
import { useTranslation } from "@/components/locale-provider";
import { cn, getModifierKey } from "@/utils/utils";

import {
  readCanvasShortcutHintCollapsed,
  writeCanvasShortcutHintCollapsed,
} from "./canvas-shortcut-hint-storage";

const PANEL_HORIZONTAL_INSET_PX = 48;
const TOOLBAR_SECTION_GAP_PX = 8;

export interface CanvasShortcutHintToolbarLayout {
  readonly toolbarWidth: number;
  readonly newNodeWidth: number;
  readonly operationsWidth: number;
  readonly keyboardWidth: number;
  readonly layoutWidth: number;
}

const EMPTY_TOOLBAR_LAYOUT: CanvasShortcutHintToolbarLayout = {
  toolbarWidth: 0,
  newNodeWidth: 0,
  operationsWidth: 0,
  keyboardWidth: 0,
  layoutWidth: 0,
};

export const actionBarButtonOutlineClassName =
  "bg-white hover:bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200";

const PANEL_CLASS =
  "relative box-border rounded-2xl border border-neutral-200/80 bg-white/95 text-neutral-800 shadow-lg backdrop-blur-lg dark:border-white/15 dark:bg-neutral-900/95 dark:text-neutral-200";

const PANEL_ARROW_CLASS =
  "[--shortcut-panel-arrow-fill:rgb(255_255_255/0.95)] [--shortcut-panel-arrow-stroke:rgb(229_229_229/0.8)] dark:[--shortcut-panel-arrow-fill:rgb(23_23_23/0.95)] dark:[--shortcut-panel-arrow-stroke:rgb(255_255_255/0.15)]";

const COLUMN_DIVIDER_CLASS =
  "w-px shrink-0 self-stretch bg-neutral-200 dark:bg-white/15";

const MUTED_LABEL_CLASS =
  "text-sm leading-snug text-neutral-500 dark:text-neutral-400";

const KBD_CLASS =
  "inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border-[0.5px] border-neutral-300 px-1 font-sans text-sm leading-5 text-neutral-800 dark:border-[#363636] dark:text-white";

const KBD_COMBO_CLASS =
  "flex shrink-0 flex-wrap items-center justify-end gap-2 text-sm leading-5 text-neutral-800 dark:text-white";

const KBD_SEP_CLASS = "text-sm leading-5 text-[#919191]";

function ShortcutKbd({ children }: { readonly children: string }) {
  return <kbd className={KBD_CLASS}>{children}</kbd>;
}

function ShortcutKbdCombo({ keys }: { readonly keys: readonly string[] }) {
  return (
    <div className={KBD_COMBO_CLASS}>
      {keys.map((key, index) => (
        <Fragment key={`${key}-${index}`}>
          {index > 0 ? <span className={KBD_SEP_CLASS}>+</span> : null}
          <ShortcutKbd>{key}</ShortcutKbd>
        </Fragment>
      ))}
    </div>
  );
}

const PLAIN_SHORTCUT_TEXT_CLASS =
  "text-sm leading-5 text-neutral-800 dark:text-white";

function ShortcutKbdWithIcon({
  icon,
  children,
}: {
  readonly icon: ReactNode;
  readonly children: string;
}) {
  return (
    <kbd className={cn(KBD_CLASS, "gap-1 px-2")}>
      {icon}
      {children}
    </kbd>
  );
}

function MultiSelectShortcutRow({
  clickLabel,
  dragLabel,
}: {
  readonly clickLabel: string;
  readonly dragLabel: string;
}) {
  return (
    <div className={KBD_COMBO_CLASS}>
      <ShortcutKbd>Shift</ShortcutKbd>
      <span className={KBD_SEP_CLASS}>+</span>
      <span className={PLAIN_SHORTCUT_TEXT_CLASS}>
        {clickLabel}
        <span className={KBD_SEP_CLASS}> / </span>
        {dragLabel}
      </span>
    </div>
  );
}

function DeleteShortcutRow({ deleteKeyLabel }: { readonly deleteKeyLabel: string }) {
  return (
    <div className={KBD_COMBO_CLASS}>
      <ShortcutKbdWithIcon
        icon={
          <DeleteKey className="size-4 shrink-0 text-neutral-600 dark:text-neutral-300" />
        }
      >
        {deleteKeyLabel}
      </ShortcutKbdWithIcon>
    </div>
  );
}

function ClipboardModifierShortcutRow({
  modifierKey,
}: {
  readonly modifierKey: string;
}) {
  const keys = ["C", "X", "V"] as const;

  return (
    <div className={KBD_COMBO_CLASS}>
      <ShortcutKbd>{modifierKey}</ShortcutKbd>
      <span className={KBD_SEP_CLASS}>+</span>
      {keys.map((key, index) => (
        <Fragment key={key}>
          {index > 0 ? <span className={KBD_SEP_CLASS}>/</span> : null}
          <ShortcutKbd>{key}</ShortcutKbd>
        </Fragment>
      ))}
    </div>
  );
}

interface LibtvShortcutRowProps {
  readonly label?: string;
  readonly labelLines?: readonly string[];
  readonly keys?: readonly string[];
  readonly keysContent?: ReactNode;
}

function LibtvShortcutRow({
  label,
  labelLines,
  keys,
  keysContent,
}: LibtvShortcutRowProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      {labelLines ? (
        <span
          className={cn(
            MUTED_LABEL_CLASS,
            "flex min-w-0 flex-1 flex-col pr-2 text-left"
          )}
        >
          {labelLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      ) : (
        <span className={cn(MUTED_LABEL_CLASS, "min-w-0 flex-1 pr-2 text-left")}>
          {label}
        </span>
      )}
      {keysContent ?? (keys ? <ShortcutKbdCombo keys={keys} /> : null)}
    </div>
  );
}

function ToolbarSectionLabel({ children }: { readonly children: string }) {
  return (
    <div className="flex h-7 w-full items-center justify-center">
      <span className={cn(MUTED_LABEL_CLASS, "text-center")}>{children}</span>
    </div>
  );
}

function ShortcutPanelArrow() {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none" aria-hidden>
      <path
        d="M0 2 L6.6 8.4 a2 2 0 0 0 2.8 0 L16 2"
        fill="var(--shortcut-panel-arrow-fill)"
        stroke="var(--shortcut-panel-arrow-stroke)"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <rect
        x="0"
        y="0"
        width="16"
        height="2"
        fill="var(--shortcut-panel-arrow-fill)"
      />
    </svg>
  );
}

function getKeyboardArrowLeftPx(
  layout: CanvasShortcutHintToolbarLayout,
  panelWidth: number
): number {
  const keyboardCenter =
    layout.newNodeWidth +
    TOOLBAR_SECTION_GAP_PX +
    layout.operationsWidth +
    TOOLBAR_SECTION_GAP_PX +
    layout.keyboardWidth / 2;
  const panelLeft = (layout.toolbarWidth - panelWidth) / 2;

  return keyboardCenter - panelLeft;
}

function measureSectionWidth(element: HTMLElement | null): number {
  return element?.offsetWidth ?? 0;
}

export function useCanvasShortcutHintToolbarLayout({
  toolbarRef,
  newNodeRef,
  operationsRef,
  keyboardRef,
  layoutRef,
}: {
  readonly toolbarRef: RefObject<HTMLElement | null>;
  readonly newNodeRef: RefObject<HTMLElement | null>;
  readonly operationsRef: RefObject<HTMLElement | null>;
  readonly keyboardRef: RefObject<HTMLElement | null>;
  readonly layoutRef: RefObject<HTMLElement | null>;
}): CanvasShortcutHintToolbarLayout {
  const [layout, setLayout] = useState<CanvasShortcutHintToolbarLayout>(
    EMPTY_TOOLBAR_LAYOUT
  );

  useEffect(() => {
    const measure = () => {
      const toolbar = toolbarRef.current;
      if (!toolbar) {
        return;
      }

      setLayout({
        toolbarWidth: toolbar.offsetWidth,
        newNodeWidth: measureSectionWidth(newNodeRef.current),
        operationsWidth: measureSectionWidth(operationsRef.current),
        keyboardWidth: measureSectionWidth(keyboardRef.current),
        layoutWidth: measureSectionWidth(layoutRef.current),
      });
    };

    measure();

    const observer = new ResizeObserver(measure);
    if (toolbarRef.current) {
      observer.observe(toolbarRef.current);
    }

    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [keyboardRef, layoutRef, newNodeRef, operationsRef, toolbarRef]);

  return layout;
}

export function useCanvasShortcutHintState() {
  const [collapsed, setCollapsed] = useState(() =>
    readCanvasShortcutHintCollapsed()
  );

  const setCollapsedPersisted = useCallback((next: boolean) => {
    writeCanvasShortcutHintCollapsed(next);
    setCollapsed(next);
  }, []);

  const toggle = useCallback(() => {
    setCollapsedPersisted(!collapsed);
  }, [collapsed, setCollapsedPersisted]);

  return {
    collapsed,
    setCollapsed: setCollapsedPersisted,
    toggle,
  };
}

interface CanvasShortcutHintButtonProps {
  readonly collapsed: boolean;
  readonly onToggle: (event: MouseEvent) => void;
}

export function CanvasShortcutHintButton({
  collapsed,
  onToggle,
}: CanvasShortcutHintButtonProps) {
  const { t } = useTranslation();

  return (
    <ActionBarButton
      onClick={onToggle}
      className={cn(
        actionBarButtonOutlineClassName,
        !collapsed &&
          "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
      )}
      tooltip={collapsed ? t("workflow.canvas.shortcutHint.expand") : undefined}
      tooltipSide="top"
    >
      <Keyboard className="size-4!" />
    </ActionBarButton>
  );
}

interface CanvasShortcutHintPanelProps {
  readonly layout: CanvasShortcutHintToolbarLayout;
  readonly onClose: () => void;
}

export function CanvasShortcutHintPanel({
  layout,
  onClose,
}: CanvasShortcutHintPanelProps) {
  const { t } = useTranslation();
  const modifierKey = getModifierKey();

  if (layout.toolbarWidth <= 0) {
    return null;
  }

  const panelWidth = layout.toolbarWidth + PANEL_HORIZONTAL_INSET_PX;
  const arrowLeftPx = getKeyboardArrowLeftPx(layout, panelWidth);

  const leftShortcuts = [
    {
      label: t("workflow.canvas.shortcutHint.undo"),
      keys: [modifierKey, "Z"],
    },
    {
      label: t("workflow.canvas.shortcutHint.redo"),
      keys: ["Shift", modifierKey, "Z"],
    },
    {
      label: t("workflow.canvas.shortcutHint.multiSelect"),
      keysContent: (
        <MultiSelectShortcutRow
          clickLabel={t("workflow.canvas.shortcutHint.clickAction")}
          dragLabel={t("workflow.canvas.shortcutHint.dragAction")}
        />
      ),
    },
  ] as const;

  const rightShortcuts = [
    {
      label: t("workflow.canvas.delete"),
      keysContent: (
        <DeleteShortcutRow
          deleteKeyLabel={t("workflow.canvas.shortcutHint.deleteKey")}
        />
      ),
    },
    {
      labelLines: [
        t("workflow.canvas.copy"),
        t("workflow.canvas.cut"),
        t("workflow.canvas.paste"),
      ],
      keysContent: <ClipboardModifierShortcutRow modifierKey={modifierKey} />,
    },
  ] as const;

  return (
    <div
      className={cn(
        "nodrag nopan nowheel pointer-events-auto absolute bottom-full left-1/2 z-[60] mb-4 -translate-x-1/2",
        PANEL_ARROW_CLASS
      )}
      style={{ width: panelWidth }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className={cn("p-4 md:p-6", PANEL_CLASS)}
        role="region"
        aria-label={t("workflow.canvas.shortcutHint.title")}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {t("workflow.canvas.shortcutHint.title")}
          </span>
          <button
            type="button"
            className="rounded-lg p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            aria-label={t("workflow.canvas.shortcutHint.collapse")}
            title={t("workflow.canvas.shortcutHint.collapse")}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-4 flex items-stretch gap-5 border-b border-neutral-200 pb-4 dark:border-white/15">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {leftShortcuts.map((item) => (
              <LibtvShortcutRow
                key={
                  "label" in item && item.label
                    ? item.label
                    : "labelLines" in item
                      ? item.labelLines.join("-")
                      : ""
                }
                label={"label" in item ? item.label : undefined}
                labelLines={"labelLines" in item ? item.labelLines : undefined}
                keys={"keys" in item ? item.keys : undefined}
                keysContent={
                  "keysContent" in item ? item.keysContent : undefined
                }
              />
            ))}
          </div>

          <div className={COLUMN_DIVIDER_CLASS} aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {rightShortcuts.map((item) => (
              <LibtvShortcutRow
                key={
                  "label" in item && item.label
                    ? item.label
                    : "labelLines" in item
                      ? item.labelLines.join("-")
                      : ""
                }
                label={"label" in item ? item.label : undefined}
                labelLines={"labelLines" in item ? item.labelLines : undefined}
                keys={"keys" in item ? item.keys : undefined}
                keysContent={
                  "keysContent" in item ? item.keysContent : undefined
                }
              />
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="shrink-0" style={{ width: layout.newNodeWidth }}>
            <ToolbarSectionLabel>
              {t("workflow.canvas.shortcutHint.sectionNewNode")}
            </ToolbarSectionLabel>
          </div>

          <div className="shrink-0" style={{ width: layout.operationsWidth }}>
            <ToolbarSectionLabel>
              {t("workflow.canvas.shortcutHint.sectionOperations")}
            </ToolbarSectionLabel>
          </div>

          <div
            className="shrink-0"
            style={{ width: layout.keyboardWidth }}
            aria-hidden
          />

          <div className="shrink-0" style={{ width: layout.layoutWidth }}>
            <ToolbarSectionLabel>
              {t("workflow.canvas.shortcutHint.sectionLayout")}
            </ToolbarSectionLabel>
          </div>
        </div>
      </div>

      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: arrowLeftPx,
          bottom: -8,
          transform: "translateX(-50%)",
        }}
      >
        <ShortcutPanelArrow />
      </span>
    </div>
  );
}
