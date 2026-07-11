import { useTranslation } from "@/components/locale-provider";
import { CodeBlock } from "@/components/docs/code-block";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PUBLISH_QUEUE_SNIPPETS } from "@/components/workflow/api-snippets";
import { getApiBaseUrl } from "@/config/api";

interface QueueSnippetsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  queueName: string;
  queueId: string;
}

export function QueueSnippetsDialog({
  isOpen,
  onClose,
  queueName,
  queueId,
}: QueueSnippetsDialogProps) {
  const { t } = useTranslation();
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const publishUrl = `${baseUrl}/queues/${queueId}/publish`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {queueName || t("pages.queues.untitled")}
          </DialogTitle>
          <DialogDescription>
            {t("pages.queues.snippets.description")}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="curl" className="w-full min-w-0">
          <TabsList>
            <TabsTrigger value="curl">
              {t("pages.queues.snippets.curl")}
            </TabsTrigger>
            <TabsTrigger value="javascript">
              {t("pages.queues.snippets.javascript")}
            </TabsTrigger>
            <TabsTrigger value="python">
              {t("pages.queues.snippets.python")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="curl" className="mt-4 min-w-0">
            <CodeBlock language="bash">
              {PUBLISH_QUEUE_SNIPPETS.curl(publishUrl)}
            </CodeBlock>
          </TabsContent>
          <TabsContent value="javascript" className="mt-4 min-w-0">
            <CodeBlock language="javascript">
              {PUBLISH_QUEUE_SNIPPETS.javascript(publishUrl)}
            </CodeBlock>
          </TabsContent>
          <TabsContent value="python" className="mt-4 min-w-0">
            <CodeBlock language="python">
              {PUBLISH_QUEUE_SNIPPETS.python(publishUrl)}
            </CodeBlock>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
