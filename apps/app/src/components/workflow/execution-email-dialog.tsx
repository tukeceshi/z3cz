import { Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: string; // base64 encoded
}

export interface EmailData {
  from: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

type ExecutionEmailDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: EmailData) => void;
  onCancel?: () => void;
};

export function ExecutionEmailDialog({
  isOpen,
  onClose,
  onSubmit,
  onCancel,
}: ExecutionEmailDialogProps) {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValid =
    from.trim() !== "" &&
    from.includes("@") &&
    subject.trim() !== "" &&
    body.trim() !== "";

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: EmailAttachment[] = [];
    for (const file of Array.from(files)) {
      const base64 = await fileToBase64(file);
      newAttachments.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        data: base64,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      from,
      subject,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setFrom("");
    setSubject("");
    setBody("");
    setAttachments([]);
    onClose();
  };

  const handleClose = () => {
    setFrom("");
    setSubject("");
    setBody("");
    setAttachments([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[500px] max-h-[80vh] flex flex-col gap-0 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DialogTitle className="text-base font-semibold">
            {t("workflow.widgets.executionEmail.title")}
          </DialogTitle>
        </div>

        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">
              {t("workflow.widgets.executionEmail.from")}
            </Label>
            <Input
              id="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={t("workflow.widgets.executionEmail.fromPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">
              {t("workflow.widgets.executionEmail.subject")}
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t(
                "workflow.widgets.executionEmail.subjectPlaceholder"
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body">
              {t("workflow.widgets.executionEmail.body")}
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("workflow.widgets.executionEmail.bodyPlaceholder")}
              className="min-h-[100px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("workflow.widgets.executionEmail.attachments")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="attachment-input"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Paperclip className="w-4 h-4 mr-2" />
              {t("workflow.widgets.executionEmail.addAttachments")}
            </Button>
            {attachments.length > 0 && (
              <div className="space-y-1 mt-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between px-2 py-1.5 bg-muted rounded-md text-sm"
                  >
                    <span className="truncate flex-1">
                      {attachment.filename}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onCancel || handleClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!isValid}>
            {t("workflow.widgets.executionEmail.sendAndRun")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      if (commaIndex === -1) {
        reject(new Error("Unexpected FileReader result format"));
        return;
      }
      resolve(result.slice(commaIndex + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
