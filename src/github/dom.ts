export function findCommentTextareas(): HTMLTextAreaElement[] {
  return Array.from(
    document.querySelectorAll<HTMLTextAreaElement>(
      'textarea[name="comment[body]"]'
    )
  );
}
