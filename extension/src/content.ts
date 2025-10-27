import { startRecording, stopRecording } from "./recorder";
import { uploadVideo } from "./upload";

// Inject a record button into a PR comment box
function injectRecordButton(commentBox: HTMLElement) {
  if (commentBox.querySelector(".pulltalk-record-btn")) return;

  console.log("Injecting PullTalk button into comment box:", commentBox);

  const btn = document.createElement("button");
  btn.textContent = "🎥 Record";
  btn.className = "pulltalk-record-btn";
  btn.style.marginLeft = "5px";
  btn.style.padding = "3px 6px";
  btn.style.fontSize = "12px";
  btn.style.cursor = "pointer";

  let recording = false;
  let recordedBlob: Blob | null = null;

  btn.addEventListener("click", async () => {
    console.log("Button clicked. Recording state:", recording);

    if (!recording) {
      recordedBlob = null;
      await startRecording(); // screen + mic
      recording = true;
      btn.textContent = "⏹ Stop";
    } else {
      recordedBlob = await stopRecording();
      recording = false;
      btn.textContent = "🎥 Record";

      if (recordedBlob) {
        const videoUrl = await uploadVideo(recordedBlob);
        const textarea = commentBox.querySelector('textarea[name="comment[body]"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value += `\n\n[Video explanation](${videoUrl})\n`;
          console.log("Inserted video link:", videoUrl);
        } else {
          console.warn("Textarea not found in comment box");
        }
      }
    }
  });

  // Insert button safely after the textarea parent
  const parent = commentBox.parentElement || commentBox;
  parent.insertBefore(btn, commentBox.nextSibling);
}

// Observe dynamically added comment boxes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        const textareas = node.querySelectorAll('textarea[name="comment[body]"]');
        textareas.forEach((textarea) => {
          injectRecordButton(textarea.parentElement!);
        });
      }
    });
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial injection for already loaded comment boxes
document.querySelectorAll('textarea[name="comment[body]"]').forEach((textarea) => {
  injectRecordButton(textarea.parentElement!);
});

console.log("PullTalk content script loaded");
