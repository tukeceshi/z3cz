import {
  MDXEditor,
  tablePlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/utils/utils";

import { STUDIO_TEXT_MDX_BODY } from "./creative-studio-surface";

export interface StudioTextMdxEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly readOnly: boolean;
  readonly contentKey: string;
  readonly onLayoutUpdated?: () => void;
  readonly className?: string;
}

export function StudioTextMdxEditor({
  value,
  onChange,
  onBlur,
  readOnly,
  contentKey,
  onLayoutUpdated,
  className,
}: StudioTextMdxEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const prevContentKeyRef = useRef(contentKey);

  const plugins = useMemo(() => [tablePlugin()], []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const contentKeyChanged = prevContentKeyRef.current !== contentKey;
    prevContentKeyRef.current = contentKey;

    if (contentKeyChanged || readOnly) {
      editor.setMarkdown(value);
      if (!onLayoutUpdated) return;
      const frameId = requestAnimationFrame(onLayoutUpdated);
      return () => cancelAnimationFrame(frameId);
    }
  }, [contentKey, onLayoutUpdated, readOnly, value]);

  return (
    <div className="studio-mdx-table-frame">
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={readOnly ? undefined : onChange}
        onBlur={readOnly ? undefined : onBlur}
        readOnly={readOnly}
        plugins={plugins}
        contentEditableClassName={STUDIO_TEXT_MDX_BODY}
        className={cn(
          "studio-mdx-editor border-0 bg-transparent shadow-none",
          className
        )}
      />
    </div>
  );
}
