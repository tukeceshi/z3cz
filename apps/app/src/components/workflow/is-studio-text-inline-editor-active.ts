export function isStudioTextInlineEditorActive(
  readOnly: boolean,
  activeEditorKey: string | null,
  editorKey: string
): boolean {
  return !readOnly && activeEditorKey === editorKey;
}
