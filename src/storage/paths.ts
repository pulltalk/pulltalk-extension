/**
 * Short object path → shorter Firebase download URLs. Owner/repo/PR live in
 * upload customMetadata for your own tooling / cleanup scripts.
 */
export function buildVideoStoragePath(
  _owner: string,
  _repo: string,
  _prId: string,
  uniqueId: string
): string {
  return `pulltalk_videos/v/${uniqueId}.webm`;
}
