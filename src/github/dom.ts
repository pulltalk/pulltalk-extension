export function findCommentTextareas(): HTMLTextAreaElement[] {
  return Array.from(
    document.querySelectorAll<HTMLTextAreaElement>(
      'textarea[name="comment[body]"]'
    )
  );
}

export function getPrimaryCommentParent(): HTMLElement | null {
  const [first] = findCommentTextareas();
  const parent = first?.parentElement;
  return parent instanceof HTMLElement ? parent : null;
}
