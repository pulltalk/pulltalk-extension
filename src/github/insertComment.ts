export function insertCommentMarkdown(
  textarea: HTMLTextAreaElement,
  markdown: string
): void {
  const separator = textarea.value.trim() ? "\n\n" : "";
  textarea.value += `${separator}${markdown}\n`;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
}
