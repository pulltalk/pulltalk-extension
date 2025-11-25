import { startRecording, stopRecording, isRecording } from "./recorder";
import { uploadVideo } from "./upload";
import { getCurrentPRId } from "./github";

/**
 * Injects a record button into a GitHub PR comment box
 * @param commentBox - The comment box element to inject the button into
 */
function injectRecordButton(commentBox: HTMLElement): void {
  // Prevent duplicate buttons
  if (commentBox.querySelector(".pulltalk-record-btn")) {
    return;
  }

  const btn = document.createElement("button");
  btn.textContent = "🎥 Record";
  btn.className = "pulltalk-record-btn";
  btn.type = "button"; // Prevent form submission
  btn.setAttribute("aria-label", "Record video comment");

  // Style the button to match GitHub's UI
  Object.assign(btn.style, {
    marginLeft: "8px",
    padding: "5px 10px",
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: "#238636",
    color: "white",
    border: "1px solid rgba(240, 246, 252, 0.1)",
    borderRadius: "6px",
    fontWeight: "500",
    transition: "background-color 0.2s",
  });

  // Hover effect
  btn.addEventListener("mouseenter", () => {
    if (btn.textContent === "🎥 Record") {
      btn.style.backgroundColor = "#2ea043";
    }
  });
  btn.addEventListener("mouseleave", () => {
    if (btn.textContent === "🎥 Record") {
      btn.style.backgroundColor = "#238636";
    }
  });

  let recording = false;

  btn.addEventListener("click", async () => {
    // Prevent multiple clicks
    if (btn.disabled) {
      return;
    }

    try {
      if (!recording) {
        // Start recording
        btn.disabled = true;
        btn.textContent = "⏸ Starting...";

        await startRecording();
        recording = true;
        btn.disabled = false;
        btn.textContent = "⏹ Stop Recording";
        btn.style.backgroundColor = "#da3633";
        btn.setAttribute("aria-label", "Stop recording");
      } else {
        // Stop recording
        btn.disabled = true;
        btn.textContent = "⏹ Stopping...";

        const recordedBlob = await stopRecording();
        recording = false;

        if (recordedBlob && recordedBlob.size > 0) {
          btn.textContent = "📤 Uploading...";

          try {
            const prId = getCurrentPRId();
            const videoUrl = await uploadVideo(recordedBlob, prId);
            const textarea = commentBox.querySelector(
              'textarea[name="comment[body]"]'
            ) as HTMLTextAreaElement | null;

            if (textarea) {
              const videoMarkdown = `\n\n[Video explanation](${videoUrl})\n`;
              textarea.value += videoMarkdown;

              // Trigger input event for GitHub's autosize
              textarea.dispatchEvent(new Event("input", { bubbles: true }));

              console.log("✅ Video link inserted:", videoUrl);
            } else {
              console.warn("⚠️ Textarea not found in comment box");
              // Fallback: show URL to user
              alert(`Video uploaded! URL: ${videoUrl}\n\nPlease copy this URL and paste it into your comment.`);
            }
          } catch (uploadError) {
            console.error("❌ Upload failed:", uploadError);
            alert(`Upload failed: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`);
          }
        } else {
          console.warn("⚠️ Recording produced empty blob");
          alert("Recording was empty. Please try again.");
        }

        // Reset button
        btn.disabled = false;
        btn.textContent = "🎥 Record";
        btn.style.backgroundColor = "#238636";
        btn.setAttribute("aria-label", "Record video comment");
      }
    } catch (error) {
      console.error("❌ Recording error:", error);
      recording = false;
      btn.disabled = false;
      btn.textContent = "🎥 Record";
      btn.style.backgroundColor = "#238636";
      btn.setAttribute("aria-label", "Record video comment");

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Recording error: ${errorMessage}`);
    }
  });

  // Insert button safely after the comment box
  const parent = commentBox.parentElement || commentBox;
  if (parent.nextSibling) {
    parent.parentElement?.insertBefore(btn, parent.nextSibling);
  } else {
    parent.parentElement?.appendChild(btn);
  }
}

/**
 * Initializes the content script and sets up observers
 */
function initialize(): void {
  // Check if we're on a PR page
  if (!window.location.href.match(/\/pull\/\d+/)) {
    return;
  }

  // Function to inject buttons into all visible comment boxes
  const injectAllButtons = (): void => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>(
      'textarea[name="comment[body]"]'
    );
    textareas.forEach((textarea) => {
      const parent = textarea.parentElement;
      if (parent && parent instanceof HTMLElement) {
        injectRecordButton(parent);
      }
    });
  };

  // Initial injection for already loaded comment boxes
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectAllButtons);
  } else {
    injectAllButtons();
  }

  // Observe dynamically added comment boxes (for GitHub's SPA navigation)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const textareas = node.querySelectorAll<HTMLTextAreaElement>(
            'textarea[name="comment[body]"]'
          );
          textareas.forEach((textarea) => {
            const parent = textarea.parentElement;
            if (parent && parent instanceof HTMLElement) {
              injectRecordButton(parent);
            }
          });
        }
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Re-inject on navigation (GitHub uses pushState)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl && url.match(/\/pull\/\d+/)) {
      lastUrl = url;
      setTimeout(injectAllButtons, 500); // Small delay for DOM to settle
    }
  }).observe(document, { subtree: true, childList: true });

  console.log("✅ PullTalk content script loaded");
}

// Start initialization
initialize();
