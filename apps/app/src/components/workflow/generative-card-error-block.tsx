import type { GenerativeCardError } from "@dafthunk/types";
import { getGenerativeCardLines } from "@dafthunk/types";
import { useLayoutEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils/utils";

interface GenerativeCardErrorBlockProps {
  readonly error: GenerativeCardError;
  readonly className?: string;
}

const LINE_CLASS =
  "whitespace-pre-wrap break-words text-sm leading-4 text-red-700 dark:text-red-300";
const TITLE_CLASS =
  "whitespace-pre-wrap break-words text-sm font-bold leading-4 text-red-800 dark:text-red-200";

export function resolveGenerativeCardDetailText(
  error: GenerativeCardError
): string {
  return error.detail?.trim() || getGenerativeCardLines(error).join("\n");
}

interface FitState {
  readonly visibleBodyLineCount: number;
  readonly truncateLastLine: boolean;
  readonly truncateTitle: boolean;
}

function ErrorLine({
  text,
  className,
  truncate = false,
}: {
  readonly text: string;
  readonly className: string;
  readonly truncate?: boolean;
}) {
  return (
    <p className={cn(className, truncate && "truncate")}>{text}</p>
  );
}

function ErrorLineStack({
  title,
  bodyLines,
  fit,
}: {
  readonly title: string | undefined;
  readonly bodyLines: readonly string[];
  readonly fit: FitState;
}) {
  const visibleBody = bodyLines.slice(0, fit.visibleBodyLineCount);

  return (
    <div className="space-y-1">
      {title ? (
        <ErrorLine
          text={title}
          className={cn(TITLE_CLASS, fit.truncateTitle && "line-clamp-2")}
        />
      ) : null}
      {visibleBody.map((line, index) => {
        const isLast = index === visibleBody.length - 1;
        return (
          <ErrorLine
            key={`${index}-${line}`}
            text={line}
            className={LINE_CLASS}
            truncate={isLast && fit.truncateLastLine}
          />
        );
      })}
    </div>
  );
}

export function GenerativeCardErrorBlock({
  error,
  className,
}: GenerativeCardErrorBlockProps) {
  const { t } = useTranslation();
  const cardLines = getGenerativeCardLines(error);
  const [title, ...bodyLines] = cardLines;
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const [fit, setFit] = useState<FitState>({
    visibleBodyLineCount: bodyLines.length,
    truncateLastLine: false,
    truncateTitle: false,
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = measureRef.current;
    if (!root || !measure) {
      return;
    }

    const computeFit = () => {
      const hintHeight = hintRef.current?.offsetHeight ?? 0;
      const availableHeight = root.clientHeight - hintHeight;

      const fits = (state: FitState): boolean => {
        measure.innerHTML = "";
        const stack = document.createElement("div");
        stack.className = "space-y-1";

        if (title) {
          const titleEl = document.createElement("p");
          titleEl.className = cn(
            TITLE_CLASS,
            state.truncateTitle && "line-clamp-2"
          );
          titleEl.textContent = title;
          stack.appendChild(titleEl);
        }

        const visibleBody = bodyLines.slice(0, state.visibleBodyLineCount);
        for (let index = 0; index < visibleBody.length; index++) {
          const line = visibleBody[index]!;
          const lineEl = document.createElement("p");
          const isLast = index === visibleBody.length - 1;
          lineEl.className = cn(
            LINE_CLASS,
            isLast && state.truncateLastLine && "truncate"
          );
          lineEl.textContent = line;
          stack.appendChild(lineEl);
        }

        measure.appendChild(stack);
        return measure.offsetHeight <= availableHeight;
      };

      let visibleBodyLineCount = bodyLines.length;
      while (visibleBodyLineCount > 0 && !fits({
        visibleBodyLineCount,
        truncateLastLine: false,
        truncateTitle: false,
      })) {
        visibleBodyLineCount -= 1;
      }

      let nextFit: FitState = {
        visibleBodyLineCount,
        truncateLastLine: false,
        truncateTitle: false,
      };

      if (
        visibleBodyLineCount < bodyLines.length &&
        fits({
          visibleBodyLineCount,
          truncateLastLine: true,
          truncateTitle: false,
        })
      ) {
        nextFit = {
          visibleBodyLineCount,
          truncateLastLine: true,
          truncateTitle: false,
        };
      }

      if (
        !fits(nextFit) &&
        title &&
        fits({
          visibleBodyLineCount: 0,
          truncateLastLine: false,
          truncateTitle: true,
        })
      ) {
        nextFit = {
          visibleBodyLineCount: 0,
          truncateLastLine: false,
          truncateTitle: true,
        };
      }

      if (!fits(nextFit) && title) {
        nextFit = {
          visibleBodyLineCount: 0,
          truncateLastLine: false,
          truncateTitle: true,
        };
      }

      setFit(nextFit);
    };

    computeFit();
    const observer = new ResizeObserver(computeFit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [bodyLines, title]);

  return (
    <div
      ref={rootRef}
      className={cn(
        "pointer-events-none absolute inset-0 z-40 flex flex-col overflow-hidden border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950",
        className
      )}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={measureRef}
          className="pointer-events-none invisible absolute inset-x-0 top-0 w-full"
          aria-hidden
        />
        <ErrorLineStack title={title} bodyLines={bodyLines} fit={fit} />
      </div>
      <p
        ref={hintRef}
        className="mt-1 shrink-0 text-sm leading-4 text-red-600/80 dark:text-red-400/80"
      >
        {t("workflow.generativeErrors.doubleClickDetailHint")}
      </p>
    </div>
  );
}

interface GenerativeCardErrorDetailDialogProps {
  readonly error: GenerativeCardError;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function GenerativeCardErrorDetailDialog({
  error,
  open,
  onOpenChange,
}: GenerativeCardErrorDetailDialogProps) {
  const { t } = useTranslation();
  const detailText = resolveGenerativeCardDetailText(error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("workflow.generativeErrors.detailTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
          {detailText}
        </div>
      </DialogContent>
    </Dialog>
  );
}
