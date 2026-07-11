import type { FeedbackCriterion, FeedbackSentimentType } from "@dafthunk/types";
import MessageCircleIcon from "lucide-react/icons/message-circle";
import MessageCircleQuestion from "lucide-react/icons/message-circle-question";
import ThumbsDown from "lucide-react/icons/thumbs-down";
import ThumbsUp from "lucide-react/icons/thumbs-up";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/locale-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useFeedback,
  useUpsertFeedback,
  useWorkflowCriteria,
} from "@/services/feedback-service";
import { cn } from "@/utils/utils";

interface ExecutionFeedbackCardProps {
  executionId: string;
  workflowId?: string;
}

export function ExecutionFeedbackCard({
  executionId,
  workflowId,
}: ExecutionFeedbackCardProps) {
  const { t } = useTranslation();
  const { criteria } = useWorkflowCriteria(workflowId || null);
  const { feedbackList, mutateFeedback } = useFeedback(executionId);
  const { upsertFeedback } = useUpsertFeedback();

  const feedbackMap = new Map(feedbackList.map((f) => [f.criterionId, f]));
  const noCriteria = criteria.length === 0;

  const handleUpsert = useCallback(
    async (
      criterionId: string,
      sentiment: FeedbackSentimentType,
      comment?: string
    ) => {
      try {
        await upsertFeedback({ executionId, criterionId, sentiment, comment });
        await mutateFeedback();
      } catch {
        toast.error(t("pages.executionDetail.feedbackCard.saveFailed"));
      }
    },
    [executionId, upsertFeedback, mutateFeedback, t]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {t("pages.executionDetail.feedbackCard.title")}
        </CardTitle>
        <CardDescription>
          {noCriteria
            ? t("pages.executionDetail.feedbackCard.noCriteriaHint")
            : t("pages.executionDetail.feedbackCard.rateDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {noCriteria ? (
          <p className="text-sm text-muted-foreground">
            {t("pages.executionDetail.feedbackCard.noCriteriaBody")}
          </p>
        ) : (
          criteria.map((criterion) => (
            <CriterionInputCard
              key={criterion.id}
              criterion={criterion}
              submitted={feedbackMap.get(criterion.id)}
              onUpsert={handleUpsert}
              commentPlaceholder={t(
                "pages.executionDetail.feedbackCard.commentPlaceholder"
              )}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function CriterionInputCard({
  criterion,
  submitted,
  onUpsert,
  commentPlaceholder,
}: {
  criterion: FeedbackCriterion;
  submitted?: { sentiment: string; comment?: string };
  onUpsert: (
    criterionId: string,
    sentiment: FeedbackSentimentType,
    comment?: string
  ) => Promise<void>;
  commentPlaceholder: string;
}) {
  const [showComment, setShowComment] = useState(!!submitted?.comment);
  const [comment, setComment] = useState(submitted?.comment ?? "");
  const commentTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sentiment = submitted
    ? (submitted.sentiment as FeedbackSentimentType)
    : null;

  const handleSentiment = (s: FeedbackSentimentType) => {
    onUpsert(criterion.id, s, comment.trim() || undefined);
  };

  const handleCommentChange = (value: string) => {
    setComment(value);
    if (!sentiment) return;
    if (commentTimerRef.current) clearTimeout(commentTimerRef.current);
    commentTimerRef.current = setTimeout(() => {
      onUpsert(criterion.id, sentiment, value.trim() || undefined);
    }, 800);
  };

  return (
    <div className="border border-border rounded-md">
      <div className="flex items-center gap-2 px-3 py-2">
        <MessageCircleQuestion className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-sm truncate" title={criterion.question}>
          {criterion.question}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleSentiment("positive")}
            className={cn(
              "p-1 rounded transition-colors",
              sentiment === "positive"
                ? "text-green-600"
                : "text-muted-foreground/40 hover:text-green-600"
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleSentiment("negative")}
            className={cn(
              "p-1 rounded transition-colors",
              sentiment === "negative"
                ? "text-red-600"
                : "text-muted-foreground/40 hover:text-red-600"
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowComment(!showComment)}
            className={cn(
              "p-1 rounded transition-colors",
              showComment || comment
                ? "text-foreground"
                : "text-muted-foreground/40 hover:text-foreground"
            )}
          >
            <MessageCircleIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {showComment && (
        <div className="px-3 pb-2">
          <Textarea
            placeholder={commentPlaceholder}
            value={comment}
            onChange={(e) => handleCommentChange(e.target.value)}
            rows={2}
            className="text-sm"
          />
        </div>
      )}
    </div>
  );
}
