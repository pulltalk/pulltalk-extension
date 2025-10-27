export function getCurrentPRId(): string | null {
  const match = window.location.href.match(/pull\/(\d+)/);
  return match ? match[1] : null;
}

export function insertComment(textarea: HTMLTextAreaElement, content: string) {
  textarea.value += `\n\n${content}\n`;
  // Optionally trigger GitHub autosize
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}
