/** URLs where we can inject content scripts / target overlay. */
export function isInjectableTabUrl(u: string): boolean {
  return !(
    u.startsWith("chrome://") ||
    u.startsWith("chrome-extension://") ||
    u.startsWith("edge://") ||
    u.startsWith("about:") ||
    u.startsWith("devtools://") ||
    u.startsWith("view-source:")
  );
}
