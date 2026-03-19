/**
 * Single readable line in the comment box; link text hides the long Firebase URL in preview.
 * Raw editor still shows the full URL once inside (...).
 */
export function formatRecordingCommentMarkdown(videoUrl: string): string {
  const dest =
    videoUrl.includes(" ") || videoUrl.includes(")")
      ? `<${videoUrl}>`
      : videoUrl;
  return `\n\n**PullTalk** · [Watch recording](${dest})\n\n`;
}
