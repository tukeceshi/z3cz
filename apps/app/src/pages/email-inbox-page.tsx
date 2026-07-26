import type {
  MailboxMessageSummary,
  MailboxThreadSummary,
} from "@dafthunk/types";
import Inbox from "lucide-react/icons/inbox";
import Paperclip from "lucide-react/icons/paperclip";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetError } from "@/components/inset-error";
import { useTranslation } from "@/components/locale-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { useOwnerPageGuard } from "@/hooks/use-owner-page-guard";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import { useEmail } from "@/services/email-service";
import {
  fetchMailboxMessageBody,
  mailboxAttachmentUrl,
  useMailboxThread,
  useMailboxThreads,
} from "@/services/mailbox-service";
import { cn } from "@/utils/utils";

export function EmailInboxPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.emails");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <EmailInboxPageContent />;
}

function EmailInboxPageContent() {
  const { t } = useTranslation();
  const { emailId } = useParams<{ emailId: string }>();
  const { organization } = useAuth();
  const orgId = organization?.id || "";

  const { email, emailError } = useEmail(emailId || null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const {
    threads,
    isThreadsLoading,
    isThreadsLoadingMore,
    isThreadsReachingEnd,
    threadsObserverTargetRef,
    threadsError,
  } = useMailboxThreads(emailId || null, search || undefined);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const activeThreadId = selectedThreadId ?? threads[0]?.id ?? null;

  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.emails"), to: `/org/${orgId}/emails` },
      { label: email?.name || t("pages.emailInbox.title") },
    ]);
  }, [setBreadcrumbs, orgId, email?.name, t]);

  if (emailError) {
    return (
      <InsetError
        title={t("pages.emailInbox.title")}
        errorMessage={emailError.message}
      />
    );
  }

  const runSearch = () => {
    setSearch(searchInput);
    setSelectedThreadId(null);
  };

  const clearSearch = () => {
    setSearch("");
    setSearchInput("");
    setSelectedThreadId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 px-4 py-2 border-b sm:flex-row sm:items-center">
        <form
          className="flex gap-2 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
        >
          <div className="flex-1">
            <SearchInput
              placeholder={t("pages.emailInbox.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            {t("pages.emailInbox.search")}
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={clearSearch}
            >
              {t("pages.emailInbox.clear")}
            </Button>
          )}
        </form>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[360px_1fr] min-h-0">
        <ThreadList
          threads={threads}
          isLoading={isThreadsLoading}
          isLoadingMore={isThreadsLoadingMore}
          isReachingEnd={isThreadsReachingEnd}
          observerTargetRef={threadsObserverTargetRef}
          error={threadsError}
          activeThreadId={activeThreadId}
          onSelect={setSelectedThreadId}
        />

        <div className="overflow-hidden">
          {activeThreadId ? (
            <ThreadDetail
              orgId={orgId}
              emailId={emailId || ""}
              threadId={activeThreadId}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  isLoading,
  isLoadingMore,
  isReachingEnd,
  observerTargetRef,
  error,
  activeThreadId,
  onSelect,
}: {
  threads: MailboxThreadSummary[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isReachingEnd: boolean;
  observerTargetRef: RefObject<HTMLDivElement | null>;
  error: Error | null;
  activeThreadId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col overflow-hidden lg:border-r">
      <div className="flex-1 overflow-y-auto">
        {isLoading && threads.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            {t("pages.emailInbox.loadingConversations")}
          </div>
        )}
        {error && (
          <div className="p-6 text-sm text-destructive">
            {t("pages.emailInbox.loadConversationsFailed", {
              message: error.message,
            })}
          </div>
        )}
        {!isLoading && !error && threads.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">
            {t("pages.emailInbox.noConversations")}
          </div>
        )}
        <ul>
          {threads.map((thread) => {
            const isSelected = thread.id === activeThreadId;
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => onSelect(thread.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-l-2 border-l-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 transition-colors",
                    isSelected &&
                      "bg-neutral-100 dark:bg-neutral-800 border-l-primary"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <SenderAvatar
                      name={thread.fromEmail}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="truncate text-sm font-medium">
                          {thread.fromEmail}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(thread.lastMessageAt)}
                        </span>
                      </div>
                      <div className="text-sm truncate text-muted-foreground">
                        {thread.subject || t("pages.emailInbox.noSubject")}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {threads.length > 0 && !isReachingEnd && (
          <div
            ref={observerTargetRef}
            className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"
          >
            {isLoadingMore && <Spinner className="size-3" />}
            {isLoadingMore ? t("pages.emailInbox.loadingMore") : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadDetail({
  orgId,
  emailId,
  threadId,
}: {
  orgId: string;
  emailId: string;
  threadId: string;
}) {
  const { t } = useTranslation();
  const { thread, messages, isThreadLoading, threadError } = useMailboxThread(
    emailId || null,
    threadId
  );

  if (isThreadLoading && !thread) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("pages.emailInbox.loadingConversation")}
      </div>
    );
  }
  if (threadError) {
    return (
      <div className="p-6 text-sm text-destructive">{threadError.message}</div>
    );
  }
  if (!thread) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b flex items-center gap-3">
        <SenderAvatar name={thread.fromEmail} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 h-10 flex flex-col justify-center leading-tight">
          <h2 className="font-semibold truncate">
            {thread.subject || t("pages.emailInbox.noSubject")}
          </h2>
          <p className="text-sm text-muted-foreground truncate font-mono">
            {thread.fromEmail}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            orgId={orgId}
            emailId={emailId}
          />
        ))}
      </div>
    </div>
  );
}

function MessageCard({
  message,
  orgId,
  emailId,
}: {
  message: MailboxMessageSummary;
  orgId: string;
  emailId: string;
}) {
  const { t } = useTranslation();
  const isInbound = message.direction === "inbound";
  const [body, setBody] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [showQuoted, setShowQuoted] = useState(false);

  const preferredPart = useMemo<"text" | "html" | null>(() => {
    if (message.hasText) return "text";
    if (message.hasHtml) return "html";
    return null;
  }, [message.hasText, message.hasHtml]);

  useEffect(() => {
    let cancelled = false;
    setBody(null);
    setBodyError(null);
    if (!preferredPart) return;
    fetchMailboxMessageBody(orgId, emailId, message.id, preferredPart)
      .then((text) => {
        if (!cancelled) setBody(text);
      })
      .catch((e) => {
        if (!cancelled)
          setBodyError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, emailId, message.id, preferredPart]);

  const { visible, quoted } =
    body && preferredPart === "text"
      ? splitQuotedText(body)
      : { visible: body ?? "", quoted: "" };

  return (
    <div className={cn("pl-4", !isInbound && "border-l-2 border-l-primary")}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="font-medium text-sm">
          {isInbound
            ? message.fromEmail
            : t("pages.emailInbox.sentLabel", { email: message.fromEmail })}
        </span>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatDate(message.createdAt)}
        </span>
      </div>

      <div className="text-sm">
        {bodyError && (
          <p className="text-muted-foreground italic text-xs" title={bodyError}>
            {t("pages.emailInbox.bodyUnavailable")}
          </p>
        )}
        {!bodyError && !preferredPart && (
          <p className="text-muted-foreground italic text-xs">
            {t("pages.emailInbox.noBody")}
          </p>
        )}
        {!bodyError && preferredPart === "text" && (
          <>
            <pre className="whitespace-pre-wrap font-sans">
              {body === null ? t("pages.emailInbox.loading") : visible}
            </pre>
            {quoted && (
              <>
                <button
                  type="button"
                  onClick={() => setShowQuoted((v) => !v)}
                  className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showQuoted
                    ? t("pages.emailInbox.hideTrimmed")
                    : t("pages.emailInbox.showTrimmed")}
                </button>
                {showQuoted && (
                  <pre className="whitespace-pre-wrap font-sans text-muted-foreground mt-2 border-l-2 border-l-neutral-200 dark:border-l-neutral-700 pl-3">
                    {quoted}
                  </pre>
                )}
              </>
            )}
          </>
        )}
        {!bodyError && preferredPart === "html" && (
          <HtmlBodyFrame html={body} />
        )}
      </div>

      {message.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.attachments.map((a) => (
            <a
              key={a.id}
              href={mailboxAttachmentUrl(orgId, emailId, a.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs border rounded px-2 py-1 hover:bg-muted"
            >
              <Paperclip className="size-3" />
              <span>{a.filename}</span>
              <span className="text-muted-foreground">
                ({formatBytes(a.sizeBytes)})
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function HtmlBodyFrame({ html }: { html: string | null }) {
  const { t } = useTranslation();

  if (html === null) {
    return (
      <p className="text-muted-foreground text-xs">
        {t("pages.emailInbox.loading")}
      </p>
    );
  }
  return (
    <iframe
      title={t("pages.emailInbox.htmlBodyTitle")}
      sandbox=""
      srcDoc={html}
      className="w-full min-h-[200px] border-0"
    />
  );
}

function SenderAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar className={className}>
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
      <Inbox className="h-8 w-8" />
      <p className="text-sm">{t("pages.emailInbox.selectConversation")}</p>
    </div>
  );
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ATTRIBUTION_RE =
  /^On .+ (wrote|écrivait|schrieb|escribió|skrev|scrisse|napisał|napisał\(a\)):\s*$/m;

function splitQuotedText(body: string): { visible: string; quoted: string } {
  const attribution = body.match(ATTRIBUTION_RE);
  if (attribution && attribution.index !== undefined) {
    return {
      visible: body.slice(0, attribution.index).trimEnd(),
      quoted: body.slice(attribution.index),
    };
  }
  const lines = body.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith(">") && lines[i + 1].startsWith(">")) {
      return {
        visible: lines.slice(0, i).join("\n").trimEnd(),
        quoted: lines.slice(i).join("\n"),
      };
    }
  }
  return { visible: body, quoted: "" };
}
