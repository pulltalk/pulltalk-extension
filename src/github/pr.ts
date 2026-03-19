export function getCurrentPRId(): string | null {
  const match = window.location.href.match(/\/pull\/(\d+)/);
  return match ? match[1] : null;
}

export function getCurrentRepo(): { owner: string; repo: string } | null {
  const match = window.location.href.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
  };
}
