import { toast } from "sonner";

export function notifyTextContentConflict(): void {
  toast.error("文字内容已过期，请刷新页面以获取最新版本。", {
    duration: 10_000,
    action: {
      label: "刷新",
      onClick: () => {
        window.location.reload();
      },
    },
  });
}
